'use strict';

const { BadRequestError, NotFoundError } = require('../utils/errorResponse');
const {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
} = require('../constants/status');
const OrderRepository = require('../repositories/order.repository');
const RefundLogRepository = require('../repositories/refundLog.repository');
const PaymentService = require('./payment.service');
const ProductRepository = require('../repositories/product.repository');
const VariantRepository = require('../repositories/variant.repository');
const {
  convertToObjectIdMongodb,
  pickFields,
  omitFields,
  listResponse,
} = require('../utils/helpers');

class RefundService {
  constructor() {
    this.orderRepository = new OrderRepository();
    this.refundLogRepository = new RefundLogRepository();
    this.paymentService = new PaymentService();
    this.productRepository = new ProductRepository();
    this.variantRepository = new VariantRepository();
  }

  async createRefundRequest({
    orderId,
    userId,
    productId,
    variantId,
    reason,
    description,
  }) {
    // 1. Kiểm tra tham số bắt buộc tối ưu
    const requiredParams = { userId, productId, orderId, reason };
    const missingParams = Object.entries(requiredParams)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingParams.length > 0) {
      throw new BadRequestError(
        `Missing required parameters: ${missingParams.join(', ')}`
      );
    }

    // 2. Tối ưu truy vấn database: Kết hợp validate và lấy dữ liệu
    const [order, productExists] = await Promise.all([
      this._validateOrder(userId, orderId),
      this._validateProductAndVariant(productId, variantId),
    ]);

    // 3. Tìm kiếm orderItem hiệu quả
    const orderItem = order.items.find(
      (item) =>
        item.productId.toString() === productId &&
        (!variantId || item.variantId?.toString() === variantId)
    );

    if (!orderItem) {
      throw new BadRequestError('Item not found in order');
    }

    // 4. Kiểm tra thời hạn trả hàng sớm
    if (orderItem.returnDays && order.deliveredAt) {
      const returnDeadline = new Date(order.deliveredAt);
      returnDeadline.setDate(returnDeadline.getDate() + orderItem.returnDays);

      if (Date.now() > returnDeadline.getTime()) {
        throw new BadRequestError('Return period has expired');
      }
    }

    // 5. Chuyển đổi ID một lần duy nhất
    const orderObjId = convertToObjectIdMongodb(orderId);
    const productObjId = convertToObjectIdMongodb(productId);
    const variantObjId = variantId ? convertToObjectIdMongodb(variantId) : null;

    // 6. Kiểm tra trùng lặp với truy vấn tối ưu
    const existingRefund = await this.refundLogRepository.getByQuery({
      rfl_order_id: orderObjId,
      'rfl_item.prd_id': productObjId,
      ...(variantId && { 'rfl_item.var_id': variantObjId }),
    });

    if (existingRefund) {
      throw new BadRequestError(
        'A refund request for this item already exists'
      );
    }

    // 7. Tạo refund log với cấu trúc rõ ràng
    const refundData = {
      rfl_order_id: orderObjId,
      rfl_item: {
        prd_id: productObjId,
        var_id: variantObjId,
        prd_quantity: orderItem.quantity,
        prd_total: orderItem.total,
      },
      rfl_amount: orderItem.total,
      rfl_payment_method: order.paymentMethod,
      rfl_reason: reason.trim(),
      rfl_description: (description || '').trim(),
      rfl_status: RefundStatus.PENDING,
      rfl_manual_required: false,
      rfl_requested_at: new Date(),
    };

    const refundLog = await this.refundLogRepository.create(refundData);

    // 8. Cập nhật trạng thái đơn hàng
    await this.orderRepository.updateById(orderId, {
      ord_status: OrderStatus.RETURN,
    });

    // 9. Lọc trường an toàn
    const SAFE_FIELDS = [
      'paymentTransactionId',
      'adminId',
      'amount',
      'order',
      'item',
      'manualRequired',
      'admin',
      'createdAt',
      'updatedAt',
    ];

    return {
      refundLog: omitFields({
        fields: SAFE_FIELDS,
        object: refundLog,
      }),
    };
  }

  async approveRefundRequest({ refundLogId, adminId }) {
    const refundLog = await this.refundLogRepository.getById(
      convertToObjectIdMongodb(refundLogId)
    );
    if (!refundLog) {
      throw new NotFoundError(`Refund request ${refundLogId} not found`);
    }

    if (refundLog.status !== RefundStatus.PENDING) {
      throw new BadRequestError('Refund request is not in PENDING status');
    }

    const updatedRefundLog = await this.refundLogRepository.updateById(
      convertToObjectIdMongodb(refundLogId),
      {
        rfl_status: RefundStatus.APPROVED,
        rfl_admin_id: convertToObjectIdMongodb(adminId),
        rfl_approved_at: new Date(),
      }
    );

    return {
      refundLogId: updatedRefundLog.id,
      status: updatedRefundLog.status,
      approvedAt: updatedRefundLog.approvedAt,
    };
  }

  async rejectRefundRequest({ refundLogId, adminId, rejectReason }) {
    const refundLog = await this.refundLogRepository.getById(refundLogId);
    if (!refundLog) {
      throw new NotFoundError(`Refund request ${refundLogId} not found`);
    }

    if (refundLog.status !== RefundStatus.PENDING) {
      throw new BadRequestError('Refund request is not in PENDING status');
    }

    if (
      !rejectReason ||
      typeof rejectReason !== 'string' ||
      rejectReason.trim().length === 0
    ) {
      throw new BadRequestError('Reject reason is required');
    }

    const updatedRefundLog = await this.refundLogRepository.updateById(
      refundLogId,
      {
        rfl_status: RefundStatus.REJECTED,
        rfl_admin_id: adminId,
        rfl_reject_reason: rejectReason.trim(),
        rfl_rejected_at: new Date(),
      }
    );

    if (!updatedRefundLog) {
      throw new InternalServerError('Failed to reject refund request');
    }

    return {
      refundLogId: updatedRefundLog.id,
      status: updatedRefundLog.status,
    };
  }

  // async markRefundNotReturned({ refundLogId, adminId, reason }) {
  //   const refundLog = await this.refundLogRepository.getById(
  //     convertToObjectIdMongodb(refundLogId)
  //   );
  //   if (!refundLog) {
  //     throw new NotFoundError(`Refund request ${refundLogId} not found`);
  //   }

  //   if (refundLog.rfl_status !== 'APPROVED') {
  //     throw new BadRequestError(
  //       'Refund request must be APPROVED to mark as not returned'
  //     );
  //   }

  //   const updatedRefundLog = await this.refundLogRepository.updateById(
  //     convertToObjectIdMongodb(refundLogId),
  //     {
  //       rfl_status: 'NOT_RETURNED',
  //       rfl_admin_id: convertToObjectIdMongodb(adminId),
  //       rfl_description: reason
  //         ? reason.trim()
  //         : 'Customer failed to return item',
  //       rfl_updated_at: new Date(),
  //     }
  //   );

  //   await this.orderRepository.updateById(refundLog.rfl_order_id, {
  //     ord_payment_status:
  //       newOrderStatus === OrderStatus.DELIVERED
  //         ? PaymentStatus.COMPLETED
  //         : PaymentStatus.PENDING_REFUND,
  //   });

  //   return {
  //     refundLogId: updatedRefundLog.id,
  //     status: updatedRefundLog.rfl_status,
  //   };
  // }

  async confirmReturnReceived({ refundLogIds, adminId, ipAddress, isCash }) {
    console.log({ refundLogIds, adminId, ipAddress, isCash });
    // Validate inputs

    if (!Array.isArray(refundLogIds)) {
      throw new BadRequestError('refundLogIds must be an array');
    }

    refundLogIds = refundLogIds.filter(
      (id) => typeof id === 'string' && id.trim() !== ''
    );

    if (refundLogIds.length === 0) {
      throw new BadRequestError('At least one valid refundLogId is required');
    }

    // Validate refund logs and ensure they belong to the same order
    let orderId = null;
    let totalRefundAmount = 0;
    const refundLogs = [];
    for (const refundLogId of refundLogIds) {
      const refundLog = await this.refundLogRepository.getById(
        convertToObjectIdMongodb(refundLogId)
      );

      console.log(refundLog);
      if (!refundLog) {
        throw new NotFoundError(`Refund request ${refundLogId} not found`);
      }

      if (refundLog.status !== RefundStatus.APPROVED) {
        throw new BadRequestError(
          `Refund request ${refundLogId} must be APPROVED`
        );
      }
      if (!orderId) {
        orderId = refundLog.orderId;
      } else if (refundLog.orderId.toString() !== orderId.toString()) {
        throw new BadRequestError(
          'All refund requests must belong to the same order'
        );
      }
      refundLogs.push(refundLog);
      totalRefundAmount += refundLog.amount;
    }

    const order = await this.orderRepository.getById(orderId);
    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }

    // Process refund
    const { refundResult, paymentStatus } = await this.processRefund({
      orderId,
      totalRefundAmount,
      refundLogIds,
      adminId,
      ipAddress,
      paymentMethod: order.paymentMethod,
      isCashRefund: isCash,
    });

    return {
      orderId,
      totalRefundAmount,
      refundResult,
      status: refundResult.status,
      refundLogIds,
    };
  }

  async processRefund({
    orderId,
    totalRefundAmount,
    refundLogIds,
    adminId,
    ipAddress,
    paymentMethod,
    isCashRefund = false,
  }) {
    // Process refund
    let refundResult;
    if (isCashRefund || paymentMethod === PaymentMethod.COD) {
      refundResult = await this.paymentService.processCODRefund({
        orderId,
        totalRefundAmount,
        adminId,
        isCashRefund,
      });
    } else if (paymentMethod === PaymentMethod.MOMO) {
      refundResult = await this.paymentService.refundMoMoPayment({
        orderId,
        totalRefundAmount,
        adminId,
      });
    } else if (paymentMethod === PaymentMethod.VNPAY) {
      refundResult = await this.paymentService.refundVNPayPayment({
        orderId,
        totalRefundAmount,
        adminId,
        ipAddress,
      });
    } else {
      throw new BadRequestError('Unsupported payment method');
    }

    // Update refund logs based on refund result
    if (refundResult.status === 'MANUAL_REQUIRED') {
      for (const refundLogId of refundLogIds) {
        await this.refundLogRepository.updateById(
          convertToObjectIdMongodb(refundLogId),
          {
            rfl_manual_required: true,
            rfl_payment_transaction_id: refundResult.refundTransaction.id,
          }
        );
      }
    } else if (refundResult.status === 'COMPLETED') {
      for (const refundLogId of refundLogIds) {
        const updatedRefund = await this.refundLogRepository.updateById(
          convertToObjectIdMongodb(refundLogId),
          {
            rfl_status: RefundStatus.COMPLETED,
            rfl_payment_transaction_id: refundResult.refundTransaction.id,
            rfl_completed_at: new Date(),
          }
        );

        // Update product and variant stats
        await this._updateProductAndVariantOnRefund({
          productId: updatedRefund.item.productId,
          variantId: updatedRefund.item.variantId,
          quantity: updatedRefund.item.quantity,
        });
      }
    } else {
      throw new InternalServerError(
        `Unexpected refund status: ${refundResult.status}`
      );
    }

    // Update order status
    await this.orderRepository.updateById(orderId, {
      ord_payment_status:
        refundResult.status === 'COMPLETED'
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PENDING_REFUND,
    });

    return {
      refundResult,
      paymentStatus:
        refundResult.status === 'COMPLETED'
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PENDING_REFUND,
    };
  }

  async getRefundDetails(refundLogId) {
    const refundLog = await this.refundLogRepository.getById(
      convertToObjectIdMongodb(refundLogId),
      [
        {
          path: 'rfl_order_id',
          select: 'ord_user_id ord_status ord_payment_method',
        },
        { path: 'rfl_admin_id', select: 'usr_name usr_email' },
        { path: 'rfl_item.prd_id', select: 'prd_name prd_main_image' },
        { path: 'rfl_item.var_id', select: 'var_name var_slug' },
      ]
    );
    if (!refundLog) {
      throw new NotFoundError(`Refund log ${refundLogId} not found`);
    }

    return omitFields({
      fields: ['orderId', 'adminId', 'createdAt', 'updatedAt'],
      object: refundLog,
    });
  }

  async getRefundRequestsForAdmin({ page = 1, size = 10, status, orderId }) {
    page = parseInt(page, 10) || 1;
    size = parseInt(size, 10) || 10;
    if (page < 1 || size < 1) {
      throw new BadRequestError('Invalid page or size');
    }

    const filter = {};
    if (status) filter.rfl_status = status;
    if (orderId) filter.rfl_order_id = convertToObjectIdMongodb(orderId);

    const queryOptions = {
      sort: '-createdAt',
      page,
      size,
    };

    const refundLogs = await this.refundLogRepository.getAll({
      filter,
      queryOptions,
      populateOptions: [
        {
          path: 'rfl_order_id',
          select: 'ord_user_id ord_status ord_payment_method',
        },
        { path: 'rfl_admin_id', select: 'usr_name usr_email' },
        { path: 'rfl_item.prd_id', select: 'prd_name prd_main_image' },
        { path: 'rfl_item.var_id', select: 'var_name var_slug' },
      ],
    });

    const total = await this.refundLogRepository.countDocuments(filter);

    const groupedByOrder = refundLogs.reduce((acc, log) => {
      const orderIdStr = log.orderId.toString();
      if (!acc[orderIdStr]) {
        acc[orderIdStr] = {
          orderId: log.orderId,
          paymentMethod: log.paymentMethod,
          orderStatus: log.order.status,
          totalRefundAmount: 0,
          refundRequests: [],
        };
      }
      if (
        ![RefundStatus.REJECTED, RefundStatus.NOT_RETURNED].includes(log.status)
      ) {
        acc[orderIdStr].totalRefundAmount += log.amount;
      }
      acc[orderIdStr].refundRequests.push({
        id: log.id,
        amount: log.amount,
        status: log.status,
        reason: log.reason,
        description: log.description,
        item: {
          productId: log.item.productId,
          productName: log.item.productName,
          variantId: log.item.variantId,
          variantName: log.item.variantName,
          image: log.item.image,
          quantity: log.item.quantity,
        },
        admin: log.admin
          ? {
              name: log.admin.name,
              email: log.admin.email,
            }
          : null,
        approvedAt: log.approvedAt,
        rejectedAt: log.rejectedAt,
        completedAt: log.completedAt,
        requestedAt: log.requestedAt,
        isManualRequired: log.manualRequired,
      });
      return acc;
    }, {});

    const paginatedOrders = Object.values(groupedByOrder);

    return listResponse({
      items: paginatedOrders,
      total,
      page,
      size,
    });
  }

  async getRefundLogByUser({ userId, page = 1, size = 10, orderId }) {
    if (!userId) {
      throw new BadRequestError('User ID is required');
    }
    page = parseInt(page, 10) || 1;
    size = parseInt(size, 10) || 10;
    if (page < 1 || size < 1) {
      throw new BadRequestError('Invalid page or size');
    }

    const filter = {
      'rfl_order_id.ord_user_id': convertToObjectIdMongodb(userId),
    };
    if (orderId) {
      filter.rfl_order_id = convertToObjectIdMongodb(orderId);
    }

    const queryOptions = {
      sort: '-rfl_requested_at',
      page,
      size,
    };

    const refundLogs = await this.refundLogRepository.getAll({
      filter,
      queryOptions,
      populateOptions: [
        {
          path: 'rfl_order_id',
          select: 'ord_user_id ord_status ord_payment_method',
        },
        { path: 'rfl_item.prd_id', select: 'prd_name prd_main_image' },
        { path: 'rfl_item.var_id', select: 'var_name var_slug' },
      ],
    });

    const total = await this.refundLogRepository.countDocuments(filter);

    const groupedByOrder = refundLogs.reduce((acc, log) => {
      const orderIdStr = log.rfl_order_id._id.toString();
      if (!acc[orderIdStr]) {
        acc[orderIdStr] = {
          orderId: log.rfl_order_id._id,
          orderStatus: log.rfl_order_id.ord_status,
          paymentMethod: log.rfl_order_id.ord_payment_method,
          totalRefundAmount: 0,
          refundRequests: [],
        };
      }
      acc[orderIdStr].totalRefundAmount += log.rfl_amount;

      let userFriendlyStatus;
      switch (log.rfl_status) {
        case RefundStatus.COMPLETED:
          userFriendlyStatus = 'Refunded';
          break;
        case RefundStatus.REJECTED:
          userFriendlyStatus = 'Rejected';
          break;
        case RefundStatus.NOT_RETURNED:
          userFriendlyStatus = 'Not Returned';
          break;
        default:
          userFriendlyStatus = 'Return In Progress';
      }

      acc[orderIdStr].refundRequests.push({
        id: log.id,
        status: userFriendlyStatus,
        reason: log.rfl_reason,
        description: log.rfl_description,
        amount: log.rfl_amount,
        item: {
          productId: log.rfl_item.prd_id._id,
          productName: log.rfl_item.prd_id.prd_name,
          variantId: log.rfl_item.var_id?._id,
          variantName: log.rfl_item.var_id?.var_name,
          quantity: log.rfl_item.prd_quantity,
        },
        requestedAt: log.rfl_requested_at,
        approvedAt: log.rfl_approved_at,
        completedAt: log.rfl_completed_at,
      });
      return acc;
    }, {});

    const paginatedOrders = Object.values(groupedByOrder);

    return {
      items: paginatedOrders,
      total,
      page,
      size,
    };
  }

  async _updateProductAndVariantOnRefund({ productId, variantId, quantity }) {
    // Update product
    await this.productRepository.updateById(productId, {
      $inc: {
        prd_returned: quantity,
        prd_sold: -quantity,
      },
    });

    // Update variant if applicable
    if (variantId) {
      await this.variantRepository.updateById(variantId, {
        $inc: {
          var_returned: quantity,
          var_sold: -quantity,
        },
      });
    }
  }

  async _validateProductAndVariant(productId, variantId) {
    const product = await this.productRepository.getById(productId);
    if (!product) {
      throw new BadRequestError('Product not found');
    }

    if (product.variants?.length > 0 && !variantId) {
      throw new BadRequestError('Variant ID is required for this product');
    }

    if (variantId) {
      const variant = await this.variantRepository.getByQuery({
        filter: { _id: convertToObjectIdMongodb(variantId), prd_id: productId },
      });
      if (!variant) {
        throw new BadRequestError('Variant not found');
      }
    }

    return product;
  }

  async _validateOrder(userId, orderId) {
    const order = await this.orderRepository.getById(orderId);

    if (!order || order.userId.toString() !== userId.toString()) {
      throw new BadRequestError('Order not found or does not belong to user');
    }

    if (![OrderStatus.DELIVERED, OrderStatus.RETURN].includes(order.status)) {
      throw new BadRequestError(
        'Order must be delivered or have an ongoing return request to refund'
      );
    }

    return order;
  }
}

module.exports = RefundService;
