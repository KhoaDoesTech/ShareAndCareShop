'use strict';

const {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  SortFieldOrder,
  PaymentSessionStatus,
} = require('../constants/status');
const {
  BadRequestError,
  NotFoundError,
  InternalServerError,
} = require('../utils/errorResponse');
const { pickFields, omitFields, listResponse } = require('../utils/helpers');
const OrderRepository = require('../repositories/order.repository');
const PaymentSessionRepository = require('../repositories/paymentSession.repository');
const ProductRepository = require('../repositories/product.repository');
const RefundLogRepository = require('../repositories/refundLog.repository');
const VariantRepository = require('../repositories/variant.repository');
const AddressService = require('./address.service');
const CouponService = require('./coupon.service');
const DeliveryService = require('./delivery.service');
const PaymentService = require('./payment.service');

class OrderService {
  constructor() {
    this.orderRepository = new OrderRepository();
    this.paymentSessionRepository = new PaymentSessionRepository();
    this.refundLogRepository = new RefundLogRepository();
    this.productRepository = new ProductRepository();
    this.variantRepository = new VariantRepository();
    this.addressService = new AddressService();
    this.couponService = new CouponService();
    this.deliveryService = new DeliveryService();
    this.paymentService = new PaymentService();

    this.statusUpdateCooldown = 5000; // 5 giây
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
      const addressDetails = await this.addressService.getPlaceDetails({
        street: shippingAddress.street,
        ward: shippingAddress.ward,
        district: shippingAddress.district,
        city: shippingAddress.city,
      });

      if (!addressDetails[0]?.placeId) {
        throw new BadRequestError('Invalid shipping address');
      }

      shippingPrice = await this.deliveryService.calculateDeliveryFee({
        deliveryId,
        destinationId: addressDetails[0].placeId,
      });
    }

    const { totalItemsPrice, totalProductDiscount, itemsDetails } =
      await this._validateAndCalculateItems({ items });

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

      discountResult.discountDetails.forEach((detail) => {
        if (detail.productId) {
          const itemIndex = itemsDetails.findIndex(
            (item) =>
              item.productId.toString() === detail.productId.toString() &&
              (!item.variantId ||
                item.variantId.toString() ===
                  (detail.variantId?.toString() || ''))
          );
          if (itemIndex !== -1) {
            itemsDetails[itemIndex].couponDiscount = detail.discount;
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
        returnDays: item.returnDays,
        total:
          item.price * item.quantity -
          (item.productDiscount + item.couponDiscount),
      })),
    };
  }

  async createOrder({
    userId,
    shippingAddress,
    items,
    couponCode = '',
    paymentMethod,
    deliveryId,
    ipAddress,
  }) {
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
    const paymentStatus = PaymentStatus.PENDING;

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
        prd_id: item.productId,
        var_id: item.variantId,
        prd_name: item.productName,
        var_slug: item.variantSlug,
        prd_img: item.image,
        prd_price: item.price,
        prd_quantity: item.quantity,
        itm_product_discount: item.productDiscount,
        itm_coupon_discount: item.couponDiscount,
        prd_return_days: item.returnDays,
      })),
      ord_items_price: itemsPrice,
      ord_items_discount: productDiscount,
      ord_coupon_discount: couponDiscount,
      ord_shipping_price: shippingPrice,
      ord_shipping_discount: shippingDiscount,
      ord_total_price: totalPrice,
      ord_payment_method: paymentMethod,
      ord_payment_status: paymentStatus,
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
      orderId: newOrder.id,
      paymentUrl,
    };
  }

  async cancelOrder({ userId, orderId, ipAddress }) {
    const order = await this.orderRepository.getByQuery({
      filter: { _id: orderId, ord_user_id: userId },
    });
    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestError('Order is already cancelled');
    }

    if (
      order.status === OrderStatus.DELIVERED ||
      order.status === OrderStatus.RETURNED
    ) {
      throw new BadRequestError('Cannot cancel delivered or returned order');
    }

    const updates = {
      ord_status: OrderStatus.CANCELLED,
      ord_payment_status: PaymentStatus.CANCELLED,
    };

    if (order.isPaid && order.paymentMethod !== PaymentMethod.COD) {
      if (!order.transactionId) {
        throw new BadRequestError('Missing transaction ID for refund');
      }

      if (order.paymentMethod === PaymentMethod.MOMO) {
        await this.paymentService.refundMoMoPayment({
          orderId,
          amount: order.totalPrice,
          transId: order.transactionId,
        });
        updates.ord_status = OrderStatus.REFUNDED;
        updates.ord_payment_status = PaymentStatus.REFUNDED;
      } else if (order.paymentMethod === PaymentMethod.VNPAY) {
        await this.paymentService.refundVNPayPayment({
          orderId,
          amount: order.totalPrice,
          transId: order.transactionId,
          ipAddress,
        });
        updates.ord_status = OrderStatus.PENDING_REFUND;
        updates.ord_payment_status = PaymentStatus.PENDING_REFUND;
      }
    }

    await this.orderRepository.updateById(orderId, updates);

    if (order.couponCode) {
      await this.couponService.revokeCoupon(order.couponCode, userId);
    }

    await this._reverseStock(order.items);

    return { status: updates.ord_status };
  }

  async updateOrderStatus({ orderId }) {
    const order = await this.orderRepository.getById(orderId);
    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }

    // Kiểm tra chống spam
    if (order.lastStatusUpdatedAt) {
      const timeSinceLastUpdate =
        Date.now() - new Date(order.lastStatusUpdatedAt).getTime();
      if (timeSinceLastUpdate < this.statusUpdateCooldown) {
        throw new BadRequestError('Please wait before updating status again');
      }
    }

    const nextStatus = this._getNextStatus(order.status);
    if (!nextStatus) {
      throw new BadRequestError(
        `No valid next status for current status ${order.status}`
      );
    }

    if (
      order.paymentMethod !== PaymentMethod.COD &&
      !order.isPaid &&
      nextStatus !== OrderStatus.CANCELLED
    ) {
      throw new BadRequestError('Payment must be completed before proceeding');
    }

    const updates = {
      ord_status: nextStatus,
      ord_last_status_updated_at: new Date(),
    };

    if (nextStatus === OrderStatus.DELIVERED) {
      updates.ord_is_delivered = true;
      updates.ord_delivered_at = new Date();
      if (order.paymentMethod === PaymentMethod.COD) {
        updates.ord_is_paid = true;
        updates.ord_paid_at = new Date();
        updates.ord_payment_status = PaymentStatus.COMPLETED;
      }
    }

    const updatedOrder = await this.orderRepository.updateById(
      orderId,
      updates
    );
    if (!updatedOrder) {
      throw new InternalServerError('Failed to update order status');
    }

    return updatedOrder;
  }

  async requestReturn({ userId, orderId, reason }) {
    const order = await this.orderRepository.getByQuery({
      filter: { _id: orderId, ord_user_id: userId },
    });
    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestError('Only delivered orders can be returned');
    }

    if (!this._canOrderBeReturned(order)) {
      throw new BadRequestError('Return period has expired');
    }

    const updates = {
      ord_status: OrderStatus.RETURN_REQUESTED,
      ord_return_reason: reason,
      ord_return_requested_at: new Date(),
      ord_payment_status: PaymentStatus.PENDING_REFUND,
    };

    const updatedOrder = await this.orderRepository.updateById(
      orderId,
      updates
    );
    if (!updatedOrder) {
      throw new InternalServerError('Failed to request return');
    }

    return updatedOrder;
  }

  async approveReturn({ orderId, adminId, ipAddress }) {
    const order = await this.orderRepository.getById(orderId);
    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }

    if (order.status !== OrderStatus.RETURN_REQUESTED) {
      throw new BadRequestError('Order is not in return requested state');
    }

    const updates = {
      ord_status: OrderStatus.RETURNED,
      ord_return_approved_at: new Date(),
      ord_payment_status: PaymentStatus.REFUNDED,
    };

    const updatedOrder = await this.orderRepository.updateById(
      orderId,
      updates
    );
    if (!updatedOrder) {
      throw new InternalServerError('Failed to approve return');
    }

    if (order.isPaid) {
      const refundLog = {
        rfl_order_id: orderId,
        rfl_transaction_id:
          order.paymentMethod === PaymentMethod.COD
            ? `COD_REFUND_${orderId}_${Date.now()}`
            : order.transactionId,
        rfl_amount: order.totalPrice,
        rfl_payment_method: order.paymentMethod,
        rfl_status: 'COMPLETED',
        rfl_admin_id: adminId,
        rfl_requested_at: new Date(),
        rfl_completed_at: new Date(),
      };

      await this.refundLogRepository.create(refundLog);

      if (order.paymentMethod !== PaymentMethod.COD) {
        await this.paymentService.refundPayment({
          orderId,
          amount: order.totalPrice,
          transId: order.transactionId,
          paymentMethod: order.paymentMethod,
          ipAddress,
        });
      }
    }

    await this._reverseStock(order.items);
    if (order.couponCode) {
      await this.couponService.revokeCoupon(order.couponCode, order.userId);
    }

    return updatedOrder;
  }

  async getOrderDetailsForUser({ userId, orderId, ipAddress }) {
    const order = await this.orderRepository.getByQuery({
      filter: { _id: orderId, ord_user_id: userId },
      options: {
        populate: [{ path: 'ord_delivery_method', select: 'dlv_name' }],
      },
    });
    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }

    let paymentUrl = null;
    if (
      !order.isPaid &&
      order.status === OrderStatus.AWAITING_PAYMENT &&
      [PaymentMethod.VNPAY, PaymentMethod.MOMO].includes(order.paymentMethod)
    ) {
      const session = await this.paymentSessionRepository.getByQuery({
        filter: {
          pms_order_id: order.id,
          pms_payment_method: order.paymentMethod,
          pms_status: PaymentSessionStatus.PENDING,
          pms_expires_at: { $gt: new Date() },
        },
      });

      paymentUrl =
        session?.paymentUrl ||
        (await this.paymentService.resendPaymentUrl({
          orderId: order.id,
          userId,
          ipAddress,
        }));
    }

    return {
      order: {
        id: order.id,
        totalPrice: order.totalPrice,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        deliveryMethod: order.deliveryMethod?.name || null,
        shippingAddress: pickFields({
          fields: ['fullname', 'phone', 'city', 'district', 'ward', 'street'],
          object: order.shippingAddress,
        }),
        items: order.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          variantSlug: item.variantSlug,
          image: item.image,
          price: item.price,
          quantity: item.quantity,
          productDiscount: item.productDiscount,
          couponDiscount: item.couponDiscount,
          returnDays: item.returnDays,
          canReturn:
            order.status === OrderStatus.DELIVERED &&
            this._isItemReturnable(order.deliveredAt, item.returnDays),
        })),
        createdAt: order.createdAt,
        deliveredAt: order.deliveredAt,
      },
      paymentUrl,
    };
  }

  async getOrderDetailsForAdmin({ orderId }) {
    const order = await this.orderRepository.getById(orderId);
    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }

    return {
      order: {
        id: order.id,
        userId: order.userId,
        totalPrice: order.totalPrice,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        deliveryMethod: order.deliveryMethod?.name || null,
        shippingAddress: pickFields({
          fields: ['fullname', 'phone', 'city', 'district', 'ward', 'street'],
          object: order.shippingAddress,
        }),
        items: order.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          variantSlug: item.variantSlug,
          image: item.image,
          price: item.price,
          quantity: item.quantity,
          productDiscount: item.productDiscount,
          couponDiscount: item.couponDiscount,
          returnDays: item.returnDays,
        })),
        returnReason: order.returnReason,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        deliveredAt: order.deliveredAt,
        nextStatus: this._getNextStatus(order.status),
      },
    };
  }

  async getOrdersListForUser({ userId, page = 1, size = 10 }) {
    page = parseInt(page, 10) || 1;
    size = parseInt(size, 10) || 10;
    if (page < 1 || size < 1) {
      throw new BadRequestError('Invalid page or size');
    }

    const filter = { ord_user_id: userId };
    const queryOptions = { sort: '-createdAt', page, size };
    const orders = await this.orderRepository.getAllOrder({
      filter,
      queryOptions,
      populateOptions: [{ path: 'ord_delivery_method', select: 'dlv_name' }],
    });

    const total = await this.orderRepository.countDocuments(filter);

    return listResponse({
      items: orders.map((order) => ({
        id: order.id,
        totalPrice: order.totalPrice,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        deliveryMethod: order.deliveryMethod?.name || null,
        items: order.items.map((item) => ({
          productName: item.productName,
          image: item.image,
          quantity: item.quantity,
        })),
        createdAt: order.createdAt,
      })),
      total,
      page,
      size,
    });
  }

  async getOrdersListForAdmin({
    search,
    status,
    nextStatus,
    sort,
    paymentMethod,
    page = 1,
    size = 10,
  }) {
    page = parseInt(page, 10) || 1;
    size = parseInt(size, 10) || 10;
    if (page < 1 || size < 1) {
      throw new BadRequestError('Invalid page or size');
    }

    const filter = {};
    if (search) {
      const keyword = search.trim();
      filter.$or = [
        {
          'ord_shipping_address.shp_fullname': {
            $regex: keyword,
            $options: 'i',
          },
        },
        {
          'ord_shipping_address.shp_phone': { $regex: keyword, $options: 'i' },
        },
      ];
    }

    if (status) filter.ord_status = status;
    if (paymentMethod) filter.ord_payment_method = paymentMethod;

    const mappedSort = sort
      ? `${sort.startsWith('-') ? '-' : ''}${
          SortFieldOrder[sort.replace('-', '')] || 'createdAt'
        }`
      : '-createdAt';
    const queryOptions = { sort: mappedSort, page, size };

    let orders = await this.orderRepository.getAllOrder({
      filter,
      queryOptions,
      populateOptions: [{ path: 'ord_delivery_method', select: 'dlv_name' }],
    });

    if (nextStatus) {
      orders = orders.filter(
        (order) => this._getNextStatus(order.status) === nextStatus
      );
    }

    const total = await this.orderRepository.countDocuments(filter);

    return listResponse({
      items: orders.map((order) => ({
        id: order.id,
        userId: order.userId,
        totalPrice: order.totalPrice,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        deliveryMethod: order.deliveryMethod?.name || null,
        items: order.items.map((item) => ({
          productName: item.productName,
          image: item.image,
          quantity: item.quantity,
        })),
        shippingAddress: {
          fullname: order.shippingAddress?.fullname,
          phone: order.shippingAddress?.phone,
        },
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        nextStatus: this._getNextStatus(order.status),
      })),
      total,
      page,
      size,
    });
  }

  async _validateAndCalculateItems({ items }) {
    let totalItemsPrice = 0;
    let totalProductDiscount = 0;
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
            filter: { _id: item.variantId, prd_id: item.productId },
          })
        : null;

      if (item.variantId && !variant) {
        throw new NotFoundError(`Variant ${item.variantId} not found`);
      }

      const availableQuantity = variant ? variant.quantity : product.quantity;
      if (availableQuantity < item.quantity) {
        throw new BadRequestError(
          `Insufficient stock for product ${item.productId}`
        );
      }

      if (
        (variant ? variant.status : product.status) !== ProductStatus.PUBLISHED
      ) {
        throw new BadRequestError(`Product ${item.productId} is not available`);
      }

      const price = variant ? variant.price : product.originalPrice;
      const productDiscount = this._calculateProductDiscount(product, price);

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
        returnDays: product.returnDays,
      });
    }

    return { totalItemsPrice, totalProductDiscount, itemsDetails };
  }

  _calculateProductDiscount(product, price) {
    const now = new Date();
    const isDiscountActive =
      product.discountStart &&
      product.discountEnd &&
      now >= new Date(product.discountStart) &&
      now <= new Date(product.discountEnd) &&
      product.discountValue > 0;

    if (!isDiscountActive) {
      return 0;
    }

    return product.discountType === 'AMOUNT'
      ? product.discountValue
      : price * (product.discountValue / 100);
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
            var_status: ProductStatus.OUT_OF_STOCK,
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
          prd_status: ProductStatus.OUT_OF_STOCK,
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
            var_status: ProductStatus.PUBLISHED,
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
          prd_status: ProductStatus.PUBLISHED,
        });
      }
    }
  }

  _getNextStatus(orderStatus) {
    const NEXT_STATUS = {
      [OrderStatus.AWAITING_PAYMENT]: OrderStatus.PROCESSING,
      [OrderStatus.PENDING]: OrderStatus.PROCESSING,
      [OrderStatus.PROCESSING]: OrderStatus.AWAITING_SHIPMENT,
      [OrderStatus.AWAITING_SHIPMENT]: OrderStatus.SHIPPED,
      [OrderStatus.SHIPPED]: OrderStatus.DELIVERED,
      [OrderStatus.DELIVERED]: OrderStatus.RETURN_REQUESTED,
      [OrderStatus.CANCELLED]: null,
      [OrderStatus.PENDING_REFUND]: OrderStatus.REFUNDED,
      [OrderStatus.REFUNDED]: null,
      [OrderStatus.RETURN_REQUESTED]: OrderStatus.RETURNED,
      [OrderStatus.RETURNED]: null,
    };
    return NEXT_STATUS[orderStatus] || null;
  }

  _canOrderBeReturned(order) {
    if (!order.deliveredAt) return false;
    const now = new Date();
    const deliveredAt = new Date(order.deliveredAt);
    const maxReturnDays = Math.max(
      ...order.items.map((item) => item.returnDays)
    );
    return (now - deliveredAt) / (1000 * 60 * 60 * 24) <= maxReturnDays;
  }

  _isItemReturnable(deliveredAt, returnDays) {
    if (!deliveredAt) return false;
    const now = new Date();
    const deliveredDate = new Date(deliveredAt);
    return (now - deliveredDate) / (1000 * 60 * 60 * 24) <= returnDays;
  }
}

module.exports = OrderService;
