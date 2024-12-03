'use strict';
const {
  ProductStatus,
  OrderStatus,
  PaymentMethod,
  SortFieldOrder,
} = require('../constants/status');
const OrderRepository = require('../repositories/order.repository');
const ProductRepository = require('../repositories/product.repository');
const VariantRepository = require('../repositories/variant.repository');
const {
  BadRequestError,
  NotFoundError,
  InternalServerError,
} = require('../utils/errorResponse');
const { pickFields, omitFields } = require('../utils/helpers');
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

    let status = OrderStatus.PENDING;
    if (paymentMethod !== PaymentMethod.COD) {
      status = OrderStatus.AWAITING_PAYMENT;
    }

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
      ord_status: status,
    });

    // Step 4: Update stock for products and variants
    await this._updateStock(itemsDetails);

    return newOrder;
  }

  async _updateStock(items) {
    for (const item of items) {
      if (item.variantId) {
        // Update variant stock and sold count
        const updatedVariant = await this.variantRepository.updateById(
          item.variantId,
          {
            $inc: {
              var_quantity: -item.quantity,
              var_sold: item.quantity,
            },
          },
          { new: true }
        );

        // Check and update variant's stock status
        if (updatedVariant.quantity <= 0) {
          await this.variantRepository.updateById(item.variantId, {
            status: ProductStatus.OUT_OF_STOCK,
          });
        }
      }

      // Update parent product's stock and sold count
      const updatedProduct = await this.productRepository.updateById(
        item.productId,
        {
          $inc: {
            prd_quantity: -item.quantity,
            prd_sold: item.quantity,
          },
        },
        { new: true }
      );

      // Check and update product's stock status
      if (updatedProduct.quantity <= 0) {
        await this.productRepository.updateById(item.productId, {
          status: ProductStatus.OUT_OF_STOCK,
        });
      }
    }
  }

  async _reverseStock(items) {
    for (const item of items) {
      if (item.variantId) {
        // Revert variant stock and sold count
        const updatedVariant = await this.variantRepository.updateById(
          item.variantId,
          {
            $inc: {
              var_quantity: item.quantity,
              var_sold: -item.quantity,
            },
          },
          { new: true }
        );

        // Remove OUT_OF_STOCK status if stock is restored
        if (updatedVariant.status === ProductStatus.OUT_OF_STOCK) {
          await this.variantRepository.updateById(item.variantId, {
            status: ProductStatus.PUBLISHED,
          });
        }
      }
      // Revert product sold count for variant's parent product
      const updatedProduct = await this.productRepository.updateById(
        item.productId,
        {
          $inc: {
            prd_quantity: item.quantity,
            prd_sold: -item.quantity,
          },
        },
        { new: true }
      );
      // Remove OUT_OF_STOCK status if stock is restored
      if (updatedProduct.status === ProductStatus.OUT_OF_STOCK) {
        await this.productRepository.updateById(item.productId, {
          status: ProductStatus.PUBLISHED,
        });
      }
    }
  }

  async updateOrderStatus(orderId) {
    const foundOrder = await this.orderRepository.getById(orderId);
    if (!foundOrder) throw new NotFoundError(`Order ${orderId} not found`);

    // Define next state transitions
    const NEXT_STATUS = {
      [OrderStatus.AWAITING_PAYMENT]: () => null,
      [OrderStatus.PENDING]: () => OrderStatus.PROCESSING,
      [OrderStatus.PAID]: () => OrderStatus.PROCESSING,
      [OrderStatus.PROCESSING]: () => OrderStatus.AWAITING_SHIPMENT,
      [OrderStatus.AWAITING_SHIPMENT]: () => OrderStatus.SHIPPED,
      [OrderStatus.SHIPPED]: () => {
        foundOrder.deliveredAt = new Date();
        foundOrder.isDelivered = true;
        return OrderStatus.DELIVERED;
      },
      [OrderStatus.DELIVERED]: () => {
        throw new BadRequestError('Order is already delivered');
      },
      [OrderStatus.CANCELLED]: () => {
        throw new BadRequestError('Order is already cancelled');
      },
    };

    // Transition to the next status
    if (NEXT_STATUS[foundOrder.status]) {
      foundOrder.status = NEXT_STATUS[foundOrder.status]();
    } else {
      throw new BadRequestError(
        `Cannot transition from status: ${foundOrder.status}`
      );
    }

    // Check payment handler
    if (foundOrder.paymentMethod === PaymentMethod.COD) {
      // COD: Mark as paid if delivered
      if (foundOrder.status === OrderStatus.DELIVERED) {
        foundOrder.isPaid = true;
        foundOrder.paidAt = new Date();
      }
    } else {
      // All other methods require payment to be completed beforehand
      if (!isPaid) {
        throw new BadRequestError(
          'Payment must be completed before proceeding.'
        );
      }
    }

    const updatedOrder = await this.orderRepository.updateById(orderId, {
      ord_status: foundOrder.status,
      ord_is_paid: foundOrder.isPaid,
      ord_paid_at: foundOrder.paidAt,
      ord_is_delivered: foundOrder.isDelivered,
      ord_delivered_at: foundOrder.deliveredAt,
    });

    if (!updatedOrder)
      throw new InternalServerError('Failed to update order status');
  }

  async reviewNextStatus(orderId) {
    const foundOrder = await this.orderRepository.getById(orderId);
    if (!foundOrder) throw new NotFoundError(`Order ${orderId} not found`);

    const nowStatus = foundOrder.status;

    // Transition to the next status
    const nextStatus = this._nextStatus(foundOrder.status);

    return {
      nowStatus,
      nextStatus,
      message: nextStatus
        ? `Order can transition from ${nowStatus} to ${nextStatus}.`
        : `Order with status ${nowStatus} cannot transition further.`,
    };
  }

  _nextStatus(orderStatus) {
    const NEXT_STATUS = {
      [OrderStatus.AWAITING_PAYMENT]: null,
      [OrderStatus.PENDING]: OrderStatus.PROCESSING,
      [OrderStatus.PAID]: OrderStatus.PROCESSING,
      [OrderStatus.PROCESSING]: OrderStatus.AWAITING_SHIPMENT,
      [OrderStatus.AWAITING_SHIPMENT]: OrderStatus.SHIPPED,
      [OrderStatus.SHIPPED]: OrderStatus.DELIVERED,
      [OrderStatus.DELIVERED]: null,
      [OrderStatus.CANCELLED]: null,
    };

    return NEXT_STATUS[orderStatus];
  }

  async cancelOrder({ userId, orderId }) {
    const foundOrder = await this.orderRepository.getByQuery({
      _id: orderId,
      ord_user_id: userId,
    });
    if (!foundOrder) throw new NotFoundError(`Order ${orderId} not found`);

    if (foundOrder.status === OrderStatus.CANCELLED) {
      throw new BadRequestError('Order is already cancelled');
    }

    if (foundOrder.status === OrderStatus.DELIVERED) {
      throw new BadRequestError('Cannot cancel delivered order');
    }

    // Reverse stock
    await this._reverseStock(foundOrder.items);

    // Update order status
    const updatedOrder = await this.orderRepository.updateById(orderId, {
      ord_status: OrderStatus.CANCELLED,
    });

    if (!updatedOrder) throw new InternalServerError('Failed to cancel order');

    return {
      status: updatedOrder.status,
    };
  }

  async returnOrder(orderId) {}

  async getOrderDetailsByUser({ userId, orderId }) {
    const foundOrder = await this.orderRepository.getByQuery(
      {
        _id: orderId,
        ord_user_id: userId,
      },
      {
        path: 'ord_delivery_method',
        select: 'dlv_name',
      }
    );
    if (!foundOrder) throw new NotFoundError(`Order ${orderId} not found`);

    return {
      orders: omitFields({
        object: foundOrder,
        fields: [
          'isPaid',
          'isDelivered',
          'paidAt',
          'deliveredAt',
          'createdAt',
          'updatedAt',
        ],
      }),
    };
  }

  async getOrderDetails(orderId) {
    const foundOrder = await this.orderRepository.getByQuery(
      {
        _id: orderId,
      },
      {
        path: 'ord_delivery_method',
        select: 'dlv_name',
      }
    );
    if (!foundOrder) throw new NotFoundError(`Order ${orderId} not found`);

    return {
      orders: omitFields({
        object: foundOrder,
        fields: [
          'isPaid',
          'isDelivered',
          'paidAt',
          'deliveredAt',
          'createdAt',
          'updatedAt',
        ],
      }),
    };
  }

  async getOrdersByUserId({
    userId,
    search,
    status,
    nextStatus,
    sort,
    paymentMethod,
    page = 1,
    size = 10,
  }) {
    // Initialize the filter object for querying the database
    const filter = { ord_user_id: userId };

    // Parse and validate pagination parameters
    page = parseInt(page, 10);
    size = parseInt(size, 10);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(size) || size < 1) size = 10;

    // Search by user name or phone in shipping address
    if (search) {
      const keyword = search.trim();
      const regexOptions = { $regex: keyword, $options: 'i' };

      filter.$or = [
        { 'ord_shipping_address.shp_fullname': regexOptions },
        { 'ord_shipping_address.shp_phone': regexOptions },
      ];
    }

    // Filter by status and payment method
    if (status) {
      filter.ord_status = status;
    }

    if (paymentMethod) {
      filter.ord_payment_method = paymentMethod;
    }

    // Sorting configuration
    const mappedSort = sort
      ? `${sort.startsWith('-') ? '-' : ''}${
          SortFieldOrder[sort.replace('-', '')] || 'createdAt'
        }`
      : '-createdAt';

    // Fetch orders from the repository
    const orders = await this.orderRepository.getAllOrder({
      filter,
      queryOptions: {
        sort: mappedSort,
      },
      populateOptions: {
        path: 'ord_delivery_method',
        select: 'dlv_name',
      },
    });

    // Map orders to include `nextStatus` and filter by `nextStatus` if specified
    const ordersWithNextStatus = orders
      .map((order) => ({
        ...order,
        nextStatus: this._nextStatus(order.status),
      }))
      .filter((order) => (nextStatus ? order.nextStatus === nextStatus : true));

    // Paginate the filtered orders
    const paginatedOrders = ordersWithNextStatus.slice(
      (page - 1) * size,
      page * size
    );

    const totalOrders = ordersWithNextStatus.length;
    const totalPages = Math.ceil(totalOrders / size);

    return {
      totalPages,
      totalOrders,
      currentPage: page,
      orders: paginatedOrders.map((order) =>
        pickFields({
          fields: [
            'id',
            'shippingAddress.fullname',
            'shippingAddress.phone',
            'paymentMethod',
            'deliveryMethod.id',
            'deliveryMethod.name',
            'totalPrice',
            'status',
            'nextStatus',
          ],
          object: order,
        })
      ),
    };
  }

  async getAllOrders({
    search,
    status,
    nextStatus,
    sort,
    paymentMethod,
    page = 1,
    size = 10,
  }) {
    // Initialize the filter object for querying the database
    const filter = {};

    // Parse and validate pagination parameters
    page = parseInt(page, 10);
    size = parseInt(size, 10);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(size) || size < 1) size = 10;

    // Search by user name or phone in shipping address
    if (search) {
      const keyword = search.trim();
      const regexOptions = { $regex: keyword, $options: 'i' };

      filter.$or = [
        { 'ord_shipping_address.shp_fullname': regexOptions },
        { 'ord_shipping_address.shp_phone': regexOptions },
      ];
    }

    // Filter by status and payment method
    if (status) {
      filter.ord_status = status;
    }

    if (paymentMethod) {
      filter.ord_payment_method = paymentMethod;
    }

    // Sorting configuration
    const mappedSort = sort
      ? `${sort.startsWith('-') ? '-' : ''}${
          SortFieldOrder[sort.replace('-', '')] || 'createdAt'
        }`
      : '-createdAt';

    // Fetch orders from the repository
    const orders = await this.orderRepository.getAllOrder({
      filter,
      queryOptions: {
        sort: mappedSort,
      },
      populateOptions: {
        path: 'ord_delivery_method',
        select: 'dlv_name',
      },
    });

    // Map orders to include `nextStatus` and filter by `nextStatus` if specified
    const ordersWithNextStatus = orders
      .map((order) => ({
        ...order,
        nextStatus: this._nextStatus(order.status),
      }))
      .filter((order) => (nextStatus ? order.nextStatus === nextStatus : true));

    // Paginate the filtered orders
    const paginatedOrders = ordersWithNextStatus.slice(
      (page - 1) * size,
      page * size
    );

    const totalOrders = ordersWithNextStatus.length;
    const totalPages = Math.ceil(totalOrders / size);

    return {
      totalPages,
      totalOrders,
      currentPage: page,
      orders: paginatedOrders.map((order) =>
        pickFields({
          fields: [
            'id',
            'shippingAddress.fullname',
            'shippingAddress.phone',
            'paymentMethod',
            'deliveryMethod.id',
            'deliveryMethod.name',
            'totalPrice',
            'status',
            'nextStatus',
          ],
          object: order,
        })
      ),
    };
  }
}

module.exports = OrderService;
