'use strict';
const { ProductStatus, OrderStatus } = require('../constants/status');
const OrderRepository = require('../repositories/order.repository');
const ProductRepository = require('../repositories/product.repository');
const VariantRepository = require('../repositories/variant.repository');
const { BadRequestError, NotFoundError } = require('../utils/errorResponse');
const AddressService = require('./address.service');
const CouponService = require('./coupon.service');
const DeliveryService = require('./delivery.service');

class OrderService {
  constructor() {
    this.orderRepository = new OrderRepository();
    this.productRepository = new ProductRepository();
    this.variantRepository = new VariantRepository();
    this.addressService = new AddressService();
    this.deliveryService = new DeliveryService();
    this.couponService = new CouponService();
  }

  async reviewOrder({ items, couponCode, shippingAddress, deliveryMethod }) {}

  async validateAndCalculateItems({ items }) {
    let totalItemsPrice = 0;
    const itemsDetails = [];

    for (const item of items) {
      // Find the product
      const foundProduct = await this.productRepository.getById(item.productId);
      if (!foundProduct)
        throw new NotFoundError(`Product ${item.productId} not found`);

      // Check if product requires a variant
      if (foundProduct.variants.length > 0 && !item.variantId) {
        throw new BadRequestError(
          `Product ${foundProduct.name} requires a variantId`
        );
      }

      // Check for variant (if applicable)
      const foundVariant = item.variantId
        ? await this.variantRepository.getByQuery({
            prd_id: item.productId,
            _id: item.variantId,
          })
        : null;

      if (item.variantId && !foundVariant) {
        throw new NotFoundError(
          `Variant ${item.variantId} for Product ${foundProduct.name} not found`
        );
      }

      // Check stock quantity
      const availableQuantity = foundVariant
        ? foundVariant.quantity
        : foundProduct.quantity;

      if (availableQuantity < item.quantity) {
        throw new BadRequestError(
          `Product ${item.productId} does not have enough stock. Available: ${availableQuantity}, Requested: ${item.quantity}`
        );
      }

      // Check stock status
      const stockAvailable = foundVariant
        ? foundVariant.status
        : foundProduct.status;

      if (stockAvailable !== ProductStatus.PUBLISHED) {
        throw new BadRequestError(
          `Product ${item.productId} is not available for sale`
        );
      }

      // Calculate item price
      const price = item.variantId ? foundVariant.price : foundProduct.price;
      totalItemsPrice += price * item.quantity;

      // Prepare item details
      itemsDetails.push({
        productId: foundProduct.id,
        variantId: foundVariant?.id || null,
        productName: foundProduct.name,
        variantSlug: foundVariant?.slug || '',
        price: price,
        image: foundProduct.mainImage,
        quantity: item.quantity,
      });
    }

    return { totalItemsPrice, itemsDetails };
  }

  async createOrder({
    userId,
    couponCode = '',
    shippingAddress,
    items,
    paymentMethod,
    deliveryId,
  }) {
    // Step 1: Validate items and calculate total price
    const { totalItemsPrice, itemsDetails } =
      await this.validateAndCalculateItems({
        items,
      });
    const addressData = await this.addressService.getPlaceDetails({
      street: shippingAddress.street,
      ward: shippingAddress.ward,
      district: shippingAddress.district,
      city: shippingAddress.city,
    });

    // Step 2: Calculate order prices
    const shippingPrice = await this.deliveryService.calculateDeliveryFee({
      deliveryId,
      destinationId: addressData[0].placeId,
    });

    let discountPrice = 0;
    if (couponCode) {
      const { totalDiscount, discountDetails } =
        await this.couponService.reviewDiscount({
          items,
          totalOrder: totalItemsPrice,
          shippingFee: shippingPrice,
          couponCode,
        });

      discountPrice = totalDiscount;

      console.log({ totalDiscount, discountDetails });
    }

    const totalPrice = totalItemsPrice + shippingPrice - discountPrice;

    // Step 3: Create order
    const newOrder = this.orderRepository.create({
      ord_user_id: userId,
      ord_coupon_id: couponCode || null,
      ord_shipping_address: {
        shp_fullname: shippingAddress.fullname,
        shp_phone: shippingAddress.phone,
        shp_city: shippingAddress.city,
        shp_district: shippingAddress.district,
        shp_ward: shippingAddress.ward,
        shp_street: shippingAddress.street,
      },
      ord_items: itemsDetails.map((item) => ({
        prd_name: item.productName,
        var_slug: item.variantSlug,
        prd_quantity: item.quantity,
        prd_price: item.price,
        prd_id: item.productId,
        var_id: item.variantId,
        prd_img: item.image,
      })),
      ord_items_price: totalItemsPrice,
      ord_discount_price: discountPrice,
      ord_shipping_price: shippingPrice,
      ord_total_price: totalPrice,
      ord_payment_method: paymentMethod,
      ord_delivery_method: deliveryId,
      ord_status: OrderStatus.PENDING,
    });

    // Step 4: Update stock for products and variants
    await this._updateStock(itemsDetails);

    return newOrder;
  }

  async _updateStock(items) {
    for (const item of items) {
      if (item.variantId) {
        // Update variant stock and sold count
        await this.variantRepository.updateById(item.variantId, {
          $inc: {
            var_quantity: -item.quantity,
            var_sold: item.quantity,
          },
        });

        // Update product sold count for variant's parent product
        await this.productRepository.updateById(item.productId, {
          $inc: {
            prd_quantity: -item.quantity,
            prd_sold: item.quantity,
          },
        });
      } else {
        // Update product stock and sold count
        await this.productRepository.updateById(item.productId, {
          $inc: {
            prd_quantity: -item.quantity,
            prd_sold: item.quantity,
          },
        });
      }
    }
  }

  async _reverseStock(items) {
    for (const item of items) {
      if (item.variantId) {
        // Revert variant stock and sold count
        await this.variantRepository.updateById(item.variantId, {
          $inc: {
            var_quantity: item.quantity,
            var_sold: -item.quantity,
          },
        });

        // Revert product sold count for variant's parent product
        await this.productRepository.updateById(item.productId, {
          $inc: {
            prd_quantity: item.quantity,
            prd_sold: -item.quantity,
          },
        });
      } else {
        // Revert product stock and sold count
        await this.productRepository.updateById(item.productId, {
          $inc: {
            prd_quantity: item.quantity,
            prd_sold: -item.quantity,
          },
        });
      }
    }
  }
}

module.exports = OrderService;
