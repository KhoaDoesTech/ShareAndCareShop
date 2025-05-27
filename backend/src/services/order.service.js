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
const {
  pickFields,
  omitFields,
  convertToObjectIdMongodb,
} = require('../utils/helpers');
const AddressService = require('./address.service');
const CouponService = require('./coupon.service');
const DeliveryService = require('./delivery.service');
const PaymentService = require('./payment.service');

class OrderService {
  constructor() {
    this.orderRepository = new OrderRepository();
    this.productRepository = new ProductRepository();
    this.variantRepository = new VariantRepository();
    this.addressService = new AddressService();
    this.deliveryService = new DeliveryService();
    this.couponService = new CouponService();
    this.paymentService = new PaymentService();
  }

  async validateAndCalculateItems({ items }) {
    let totalItemsPrice = 0;
    let totalProductDiscount = 0;
    let totalCouponDiscount = 0;
    const itemsDetails = [];

    for (const item of items) {
      const product = await this.productRepository.getById(item.productId);
      if (!product) {
        throw new NotFoundError(`Product ${item.productId} not found`);
      }

      if (product.variants.length > 0 && !item.variantId) {
        throw new BadRequestError(
          `Product ${product.name} requires a variantId`
        );
      }

      const variant = item.variantId
        ? await this.variantRepository.getByQuery({
            prd_id: item.productId,
            _id: item.variantId,
          })
        : null;

      if (item.variantId && !variant) {
        throw new NotFoundError(
          `Variant ${item.variantId} for Product ${product.name} not found`
        );
      }

      const availableQuantity = variant ? variant.quantity : product.quantity;
      if (availableQuantity < item.quantity) {
        throw new BadRequestError(
          `Product ${item.productId} ${
            item.variantId ? `Variant ${item.variantId}` : ''
          } does not have enough stock. Available: ${availableQuantity}, Requested: ${
            item.quantity
          }`
        );
      }

      const stockStatus = variant ? variant.status : product.status;
      if (stockStatus !== ProductStatus.PUBLISHED) {
        throw new BadRequestError(
          `Product ${item.productId} is not available for sale`
        );
      }

      const price = variant ? variant.price : product.originalPrice;
      let productDiscount = 0;

      const now = new Date();
      const isDiscountActive =
        product.discountStart &&
        product.discountEnd &&
        now >= new Date(product.discountStart) &&
        now <= new Date(product.discountEnd) &&
        product.discountValue > 0;

      if (isDiscountActive) {
        productDiscount =
          product.discountType === 'AMOUNT'
            ? product.discountValue
            : price * (product.discountValue / 100);
      }

      totalItemsPrice += price * item.quantity;
      totalProductDiscount += productDiscount * item.quantity;

      itemsDetails.push({
        productId: product.id,
        variantId: variant?.id || null,
        productName: product.name,
        variantSlug: variant?.slug || '',
        image: product.mainImage,
        price,
        quantity: item.quantity,
        productDiscount,
        couponDiscount: 0,
      });
    }

    return {
      totalItemsPrice,
      totalProductDiscount,
      totalCouponDiscount,
      itemsDetails,
    };
  }

  async reviewOrder({
    userId,
    shippingAddress,
    items,
    couponCode = '',
    deliveryId,
  }) {
    let shippingPrice = 0;
    let shippingDiscount = 0;
    let orderDiscount = 0;
    let totalCouponDiscount = 0;

    if (shippingAddress && deliveryId) {
      const addressData = await this.addressService.getPlaceDetails({
        street: shippingAddress.street,
        ward: shippingAddress.ward,
        district: shippingAddress.district,
        city: shippingAddress.city,
      });

      shippingPrice = await this.deliveryService.calculateDeliveryFee({
        deliveryId,
        destinationId: addressData[0].placeId,
      });
    }

    const { totalItemsPrice, totalProductDiscount, itemsDetails } =
      await this.validateAndCalculateItems({ items });

    if (couponCode) {
      const discountResult = await this.couponService.reviewDiscount({
        userId,
        items,
        totalOrder: totalItemsPrice - totalProductDiscount,
        shippingFee: shippingPrice,
        couponCode,
      });

      totalCouponDiscount = discountResult.totalDiscount;
      shippingDiscount =
        discountResult.discountDetails.find((d) => d.type === 'Delivery')
          ?.discount || 0;
      orderDiscount =
        discountResult.discountDetails.find((d) => d.type === 'Order')
          ?.discount || 0;

      discountResult.discountDetails.forEach((discountDetail) => {
        if (discountDetail.productId) {
          const itemIndex = itemsDetails.findIndex(
            (item) =>
              item.productId.toString() ===
                discountDetail.productId.toString() &&
              (item.variantId
                ? item.variantId.toString() ===
                  discountDetail.variantId?.toString()
                : discountDetail.variantId === null)
          );

          if (itemIndex !== -1) {
            itemsDetails[itemIndex].couponDiscount = discountDetail.discount;
            totalCouponDiscount += discountDetail.discount;
          }
        }
      });
    }

    const totalSavings =
      totalProductDiscount + totalCouponDiscount + shippingDiscount;
    const totalPrice = totalItemsPrice + shippingPrice - totalSavings;

    return {
      itemsPrice: totalItemsPrice,
      productDiscount: totalProductDiscount,
      couponDiscount: totalCouponDiscount,
      shippingPrice,
      shippingDiscount,
      orderDiscount,
      totalSavings,
      totalPrice,
      items: itemsDetails.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        variantSlug: item.variantSlug,
        image: item.image,
        price: item.price,
        quantity: item.quantity,
        productDiscount: item.productDiscount,
        couponDiscount: item.couponDiscount,
        total:
          item.price * item.quantity -
          (item.productDiscount + item.couponDiscount),
      })),
    };
  }

  async createOrder({
    userId,
    couponCode = '',
    shippingAddress,
    items,
    paymentMethod,
    deliveryId,
    ipAddress,
  }) {
    try {
      const {
        itemsPrice,
        productDiscount,
        couponDiscount,
        shippingPrice,
        shippingDiscount,
        totalPrice,
        items: itemsDetails,
      } = await this.reviewOrder({
        userId,
        shippingAddress,
        items,
        couponCode,
        deliveryId,
      });

      const status =
        paymentMethod === PaymentMethod.COD
          ? OrderStatus.PENDING
          : OrderStatus.AWAITING_PAYMENT;

      const newOrder = await this.orderRepository.create({
        ord_user_id: userId,
        ord_coupon_code: couponCode || null,
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
          prd_discount: item.productDiscount,
          prd_coupon_discount: item.couponDiscount,
        })),
        ord_items_price: itemsPrice,
        ord_items_discount: productDiscount,
        ord_coupon_discount: couponDiscount,
        ord_shipping_price: shippingPrice,
        ord_shipping_discount: shippingDiscount,
        ord_total_price: totalPrice,
        ord_payment_method: paymentMethod,
        ord_delivery_method: deliveryId,
        ord_status: status,
      });

      if (couponCode) {
        await this.couponService.useCoupon(couponCode, userId);
      }

      await this._updateStock(itemsDetails);

      let paymentUrl = null;
      if (paymentMethod === PaymentMethod.VNPAY) {
        paymentUrl = await this.paymentService.createVNPayPaymentUrl({
          orderId: newOrder.id,
          ipAddress,
        });
      } else if (paymentMethod === PaymentMethod.MOMO) {
        paymentUrl = await this.paymentService.createMoMoPaymentUrl({
          orderId: newOrder.id,
          ipAddress,
        });
      }

      return {
        order: newOrder,
        paymentUrl,
      };
    } catch (error) {
      throw new BadRequestError(`Failed to create order: ${error.message}`);
    }
  }

  async _updateStock(items) {
    for (const item of items) {
      if (item.variantId) {
        const updatedVariant = await this.variantRepository.updateById(
          item.variantId,
          {
            $inc: { var_quantity: -item.quantity, var_sold: item.quantity },
          }
        );

        if (updatedVariant.quantity <= 0) {
          await this.variantRepository.updateById(item.variantId, {
            status: ProductStatus.OUT_OF_STOCK,
          });
        }
      }

      const updatedProduct = await this.productRepository.updateById(
        item.productId,
        {
          $inc: { prd_quantity: -item.quantity, prd_sold: item.quantity },
        }
      );

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
        const updatedVariant = await this.variantRepository.updateById(
          item.variantId,
          {
            $inc: { var_quantity: item.quantity, var_sold: -item.quantity },
          }
        );

        if (
          updatedVariant.status === ProductStatus.OUT_OF_STOCK &&
          updatedVariant.quantity > 0
        ) {
          await this.variantRepository.updateById(item.variantId, {
            status: ProductStatus.PUBLISHED,
          });
        }
      }

      const updatedProduct = await this.productRepository.updateById(
        item.productId,
        {
          $inc: { prd_quantity: item.quantity, prd_sold: -item.quantity },
        }
      );

      if (
        updatedProduct.status === ProductStatus.OUT_OF_STOCK &&
        updatedProduct.quantity > 0
      ) {
        await this.productRepository.updateById(item.productId, {
          status: ProductStatus.PUBLISHED,
        });
      }
    }
  }

  async updateOrderStatus(orderId) {
    const foundOrder = await this.orderRepository.getById(orderId);
    if (!foundOrder) throw new NotFoundError(`Order ${orderId} not found`);

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

    if (NEXT_STATUS[foundOrder.status]) {
      foundOrder.status = NEXT_STATUS[foundOrder.status]();
    } else {
      throw new BadRequestError(
        `Cannot transition from status: ${foundOrder.status}`
      );
    }

    if (foundOrder.paymentMethod === PaymentMethod.COD) {
      if (foundOrder.status === OrderStatus.DELIVERED) {
        foundOrder.isPaid = true;
        foundOrder.paidAt = new Date();
      }
    } else {
      if (!foundOrder.isPaid) {
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
    return updatedOrder;
  }

  async reviewNextStatus(orderId) {
    const foundOrder = await this.orderRepository.getById(orderId);
    if (!foundOrder) throw new NotFoundError(`Order ${orderId} not found`);

    const nowStatus = foundOrder.status;
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

    this.couponService.revokeCouponUsage(foundOrder.couponCode, userId);
    await this._reverseStock(foundOrder.items);

    const updatedOrder = await this.orderRepository.updateById(orderId, {
      ord_status: OrderStatus.CANCELLED,
    });

    if (!updatedOrder) throw new InternalServerError('Failed to cancel order');

    return { status: updatedOrder.status };
  }

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

    return { order: foundOrder };
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

    return { order: foundOrder };
  }

  async getOrdersByUserId({
    userId,
    search,
    status,
    sort,
    paymentMethod,
    page = 1,
    size = 10,
  }) {
    const filter = { ord_user_id: userId };

    if (search) {
      const keyword = search.trim();
      const regexOptions = { $regex: keyword, $options: 'i' };
      filter.$or = [
        { 'ord_shipping_address.shp_fullname': regexOptions },
        { 'ord_shipping_address.shp_phone': regexOptions },
      ];
    }

    if (status) filter.ord_status = status;
    if (paymentMethod) filter.ord_payment_method = paymentMethod;

    const mappedSort = sort
      ? `${sort.startsWith('-') ? '-' : ''}${
          SortFieldOrder[sort.replace('-', '')] || 'createdAt'
        }`
      : '-createdAt';

    const queryOptions = {
      sort: mappedSort,
      page: parseInt(page, 10),
      size: parseInt(size, 10),
    };

    const orders = await this.orderRepository.getAllOrder({
      filter,
      queryOptions,
      populateOptions: {
        path: 'ord_delivery_method',
        select: 'dlv_name',
      },
    });

    const totalOrders = await this.orderRepository.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / size);

    return {
      totalPages,
      totalOrders,
      currentPage: page,
      orders,
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
    const filter = {};

    page = parseInt(page, 10);
    size = parseInt(size, 10);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(size) || size < 1) size = 10;

    if (search) {
      const keyword = search.trim();
      const regexOptions = { $regex: keyword, $options: 'i' };
      filter.$or = [
        { 'ord_shipping_address.shp_fullname': regexOptions },
        { 'ord_shipping_address.shp_phone': regexOptions },
      ];
    }

    if (status) filter.ord_status = status;
    if (paymentMethod) filter.ord_payment_method = paymentMethod;

    const mappedSort = sort
      ? `${sort.startsWith('-') ? '-' : ''}${
          SortFieldOrder[sort.replace('-', '')] || 'createdAt'
        }`
      : '-createdAt';

    const orders = await this.orderRepository.getAllOrder({
      filter,
      queryOptions: { sort: mappedSort },
      populateOptions: {
        path: 'ord_delivery_method',
        select: 'dlv_name',
      },
    });

    const ordersWithNextStatus = orders
      .map((order) => ({
        ...order,
        nextStatus: this._nextStatus(order.status),
      }))
      .filter((order) => (nextStatus ? order.nextStatus === nextStatus : true));

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
      orders: paginatedOrders,
    };
  }
}

module.exports = OrderService;
