'use strict';

const {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
  SortFieldOrder,
  PaymentSessionStatus,
  RefundStatus,
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
const ReviewRepository = require('../repositories/review.repository');

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
    this.reviewRepository = new ReviewRepository();

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
        throw new BadRequestError('Địa chỉ giao hàng không hợp lệ');
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
    } else if (paymentMethod === PaymentMethod.COD) {
      await this.paymentService.processCODPayment({
        orderId: newOrder.id,
        adminId: null,
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
      throw new NotFoundError(`Không tìm thấy đơn hàng ${orderId}`);
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestError('Đơn hàng đã bị hủy');
    }

    if (
      ![
        OrderStatus.PENDING,
        OrderStatus.AWAITING_PAYMENT,
        OrderStatus.PROCESSING,
      ].includes(order.status)
    ) {
      throw new BadRequestError(
        'Chỉ có thể hủy đơn hàng ở trạng thái CHỜ XỬ LÝ, CHỜ THANH TOÁN hoặc ĐANG XỬ LÝ'
      );
    }

    const updates = {
      ord_status: OrderStatus.CANCELLED,
      ord_payment_status: PaymentStatus.CANCELLED,
    };

    let refundStatus = null;
    let refundMessage = null;

    if (order.isPaid && order.paymentMethod !== PaymentMethod.COD) {
      if (!order.transactionId) {
        throw new BadRequestError('Thiếu mã giao dịch để hoàn tiền');
      }

      let refundResult;
      try {
        if (order.paymentMethod === PaymentMethod.MOMO) {
          refundResult = await this.paymentService.refundMoMoPayment({
            orderId,
            totalRefundAmount: order.totalPrice,
            adminId: null,
          });
        } else if (order.paymentMethod === PaymentMethod.VNPAY) {
          refundResult = await this.paymentService.refundVNPayPayment({
            orderId,
            totalRefundAmount: order.totalPrice,
            adminId: null,
            ipAddress,
          });
        }

        if (refundResult.status === 'MANUAL_REQUIRED') {
          refundStatus = 'MANUAL_REQUIRED';
          refundMessage =
            refundResult.message ||
            'Có lỗi khi xử lý hoàn tiền, vui lòng liên hệ hỗ trợ';
          updates.ord_payment_status = PaymentStatus.PENDING_REFUND;
        } else {
          refundStatus = 'SUCCESS';
          refundMessage = 'Hoàn tiền thành công';
        }
      } catch (error) {
        console.log(error);
        refundStatus = 'FAILED';
        refundMessage = 'Có lỗi khi xử lý hoàn tiền, vui lòng liên hệ hỗ trợ';
        updates.ord_payment_status = PaymentStatus.PENDING_REFUND;
      }
    }

    await this.orderRepository.updateById(orderId, updates);

    if (order.couponCode) {
      await this.couponService.revokeCouponUsage(order.couponCode, userId);
    }

    await this._reverseStock(order.items);

    return {
      status: updates.ord_status,
      refundStatus,
      refundMessage,
    };
  }

  async updateOrderStatus({ orderId, adminId }) {
    const order = await this.orderRepository.getById(orderId);
    if (!order) {
      throw new NotFoundError(`Không tìm thấy đơn hàng ${orderId}`);
    }

    const nextStatus = this._getNextStatus(order.status);
    if (!nextStatus) {
      throw new BadRequestError(
        `Không có trạng thái tiếp theo hợp lệ cho trạng thái hiện tại: ${order.status}`
      );
    }

    if (
      nextStatus === OrderStatus.PROCESSING &&
      !order.isPaid &&
      order.paymentMethod !== PaymentMethod.COD
    ) {
      throw new BadRequestError(
        "Không thể chuyển trạng thái sang 'ĐANG XỬ LÝ' khi đơn hàng chưa thanh toán hoặc không phải COD"
      );
    }

    const updates = {
      ord_status: nextStatus,
    };

    if (
      nextStatus === OrderStatus.DELIVERED &&
      !order.isPaid &&
      order.paymentMethod === PaymentMethod.COD
    ) {
      await this.paymentService.confirmCODPayment({ orderId, adminId });
    }

    if (nextStatus === OrderStatus.DELIVERED) {
      updates.ord_is_delivered = true;
      updates.ord_delivered_at = new Date();
    }

    const updatedOrder = await this.orderRepository.updateById(
      orderId,
      updates
    );
    if (!updatedOrder) {
      throw new InternalServerError('Cập nhật trạng thái đơn hàng thất bại');
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
      throw new NotFoundError(`Không tìm thấy đơn hàng ${orderId}`);
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

    const reviewedProductIds = await this._getReviewedProductKeys(
      userId,
      order.id
    );

    // Lấy refund logs cho tất cả items trong orders
    const refundLogs = await this.refundLogRepository.getAll({
      filter: {
        rfl_order_id: { $in: order.id },
      },
    });

    // Tạo map để tra cứu refund log theo productId và variantId
    const refundLogMap = new Map();

    refundLogs.forEach((log) => {
      const key = `${log.orderId}_${log.item.productId}_${
        log.item.variantId || 'no-variant'
      }`;

      refundLogMap.set(key, log);
    });

    return {
      order: {
        id: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        canCancel: this._isOrderCancelable(order.status),
        pricing: {
          itemsPrice: order.itemsPrice,
          productDiscount: order.productDiscount,
          couponDiscount: order.couponDiscount,
          shippingPrice: order.shippingPrice,
          shippingDiscount: order.shippingDiscount,
          totalSavings: order.totalSavings,
          totalPrice: order.totalPrice,
        },
        timestamps: {
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          paidAt: order.paidAt,
          deliveredAt: order.deliveredAt,
          requestedAt: order.returnRequestedAt,
          approvedAt: order.returnApprovedAt,
        },
        deliveryMethod: order.deliveryMethod?.name || null,
        shippingAddress: pickFields({
          object: order.shippingAddress,
          fields: ['fullname', 'phone', 'city', 'district', 'ward', 'street'],
        }),
        items: order.items.map((item) => {
          const refundKey = `${order.id}_${item.productId}_${
            item.variantId || 'no-variant'
          }`;
          const hasActiveRefund = refundLogMap.has(refundKey);
          const refundLog = refundLogMap.get(refundKey);
          const canReturn = !!(
            this._isItemReturnable(order.deliveredAt, item.returnDays) &&
            !hasActiveRefund &&
            order.deliveredAt
          );
          const canReview = !!(
            order.deliveredAt &&
            !reviewedProductIds.has(`${item.productId}_${order.id}`)
          );

          return {
            ...pickFields({
              object: item,
              fields: [
                'productId',
                'variantId',
                'productName',
                'variantSlug',
                'image',
                'price',
                'quantity',
                'productDiscount',
                'couponDiscount',
                'returnDays',
                'isReviewed',
                'total',
              ],
            }),
            canReturn,
            canReview,
            returnStatus: refundLog
              ? omitFields({
                  fields: [
                    'orderId',
                    'order',
                    'paymentMethod',
                    'item',
                    'adminId',
                    'admin',
                    'createdAt',
                    'updatedAt',
                  ],
                  object: refundLog,
                })
              : null,
          };
        }),
      },
      paymentUrl,
    };
  }

  async getOrderDetailsForAdmin({ orderId }) {
    const order = await this.orderRepository.getById(orderId);
    if (!order) {
      throw new NotFoundError(`Không tìm thấy đơn hàng ${orderId}`);
    }

    return {
      order: {
        id: order.id,
        userId: order.userId,
        user: order.user,
        couponCode: order.couponCode,
        status: order.status,
        nextStatus: this._getNextStatus(order.status),
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        pricing: {
          itemsPrice: order.itemsPrice,
          productDiscount: order.productDiscount,
          couponDiscount: order.couponDiscount,
          shippingPrice: order.shippingPrice,
          shippingDiscount: order.shippingDiscount,
          totalSavings: order.totalSavings,
          totalPrice: order.totalPrice,
        },
        timestamps: {
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          paidAt: order.paidAt,
          deliveredAt: order.deliveredAt,
          requestedAt: order.returnRequestedAt,
          approvedAt: order.returnApprovedAt,
        },
        returnReason: order.returnReason,
        deliveryMethod: order.deliveryMethod,
        shippingAddress: pickFields({
          object: order.shippingAddress,
          fields: ['fullname', 'phone', 'city', 'district', 'ward', 'street'],
        }),
        items: order.items.map((item) => ({
          ...pickFields({
            object: item,
            fields: [
              'productId',
              'variantId',
              'productName',
              'variantSlug',
              'image',
              'price',
              'quantity',
              'productDiscount',
              'couponDiscount',
              'returnDays',
              'isReviewed',
              'total',
            ],
          }),
        })),
      },
    };
  }

  async getOrdersListForUser({ userId, page = 1, size = 10, status, sort }) {
    page = parseInt(page, 10) || 1;
    size = parseInt(size, 10) || 10;
    if (page < 1 || size < 1) {
      throw new BadRequestError('Trang hoặc kích thước không hợp lệ');
    }

    const filter = { ord_user_id: userId };

    if (status) filter.ord_status = status;

    const mappedSort = sort
      ? `${sort.startsWith('-') ? '-' : ''}${
          SortFieldOrder[sort.replace('-', '')] || 'createdAt'
        }`
      : '-createdAt';

    const queryOptions = { sort: mappedSort, page, size };
    const orders = await this.orderRepository.getAllOrder({
      filter,
      queryOptions,
      populateOptions: [{ path: 'ord_delivery_method', select: 'dlv_name' }],
    });

    const total = await this.orderRepository.countDocuments(filter);

    const orderIds = orders.map((order) => order.id);
    const reviewedProductIds = await this._getReviewedProductKeys(
      userId,
      orderIds
    );

    const refundLogs = await this.refundLogRepository.getAll({
      filter: {
        rfl_order_id: { $in: orderIds },
      },
    });

    // Tạo map để tra cứu refund log theo productId và variantId
    const refundLogMap = new Map();
    refundLogs.forEach((log) => {
      const key = `${log.orderId}_${log.item.productId}_${
        log.item.variantId || 'no-variant'
      }`;
      refundLogMap.set(key, log);
    });

    return listResponse({
      items: orders.map((order) => ({
        id: order.id,
        totalPrice: order.totalPrice,
        status: order.status,
        canCancel: this._isOrderCancelable(order.status),
        deliveryMethod: order.deliveryMethod?.name || null,
        deliveredAt: order.deliveredAt,
        returnAt: order.returnApprovedAt,
        createAt: order.createdAt,
        items: order.items.map((item) => {
          const refundKey = `${order.id}_${item.productId}_${
            item.variantId || 'no-variant'
          }`;
          const hasActiveRefund = refundLogMap.has(refundKey);
          const refundLog = refundLogMap.get(refundKey);
          const canReturn = !!(
            this._isItemReturnable(order.deliveredAt, item.returnDays) &&
            !hasActiveRefund &&
            order.deliveredAt
          );
          const canReview = !!(
            order.deliveredAt &&
            !reviewedProductIds.has(`${item.productId}_${order.id}`)
          );
          return {
            productId: item.productId,
            variantId: item.variantId,
            productName: item.productName,
            variantSlug: item.variantSlug,
            image: item.image,
            price: item.price,
            quantity: item.quantity,
            isReviewed: item.isReviewed,
            canReturn,
            canReview,
            returnStatus: refundLog
              ? omitFields({
                  fields: [
                    'orderId',
                    'order',
                    // 'amount',
                    'paymentMethod',
                    'item',
                    'adminId',
                    'admin',
                    'createdAt',
                    'updatedAt',
                  ],
                  object: refundLog,
                })
              : null,
          };
        }),
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
      throw new BadRequestError('Trang hoặc kích thước không hợp lệ');
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
        nextStatus: this._getNextStatus(order.status),
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
        throw new NotFoundError(`Không tìm thấy sản phẩm ${item.productId}`);
      }

      if (product.variants.length > 0 && !item.variantId) {
        throw new BadRequestError(
          `Sản phẩm ${product.name} yêu cầu chọn biến thể`
        );
      }

      const variant = item.variantId
        ? await this.variantRepository.getByQuery({
            filter: { _id: item.variantId, prd_id: item.productId },
          })
        : null;

      if (item.variantId && !variant) {
        throw new NotFoundError(`Không tìm thấy biến thể ${item.variantId}`);
      }

      const availableQuantity = variant ? variant.quantity : product.quantity;
      if (availableQuantity < item.quantity) {
        throw new BadRequestError(
          `Không đủ hàng tồn kho cho sản phẩm ${product.name} chỉ còn ${availableQuantity} sản phẩm`
        );
      }

      if (
        (variant ? variant.status : product.status) !== ProductStatus.PUBLISHED
      ) {
        throw new BadRequestError(
          `Sản phẩm ${product.name} hiện không khả dụng`
        );
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
      [OrderStatus.PROCESSING]: OrderStatus.READY_TO_SHIP,
      [OrderStatus.READY_TO_SHIP]: OrderStatus.IN_TRANSIT,
      [OrderStatus.IN_TRANSIT]: OrderStatus.DELIVERED,
      [OrderStatus.DELIVERED]: null,
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

  async _getReviewedProductKeys(userId, orderIds) {
    const reviews = await this.reviewRepository.getAll({
      filter: {
        rvw_user_id: userId,
        rvw_is_hidden: false,
        rvw_order_id: { $in: Array.isArray(orderIds) ? orderIds : [orderIds] },
      },
    });

    return new Set(
      reviews.map((review) => `${review.productId}_${review.orderId}`)
    );
  }

  _isOrderCancelable(status) {
    return [
      OrderStatus.AWAITING_PAYMENT,
      OrderStatus.PENDING,
      OrderStatus.PROCESSING,
    ].includes(status);
  }
}

module.exports = OrderService;
