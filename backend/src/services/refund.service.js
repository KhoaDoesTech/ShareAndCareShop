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
      ord_status: OrderStatus.RETURN_REQUESTED,
      ord_return_requested_at: new Date(),
    });

    // 9. Lọc trường an toàn
    const SAFE_FIELDS = [
      'paymentTransactionId',
      'adminId',
      'amount',
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

    // ĐIỂM KHÁC BIỆT: Cập nhật trạng thái đơn hàng
    const order = await this.orderRepository.getById(refundLog.orderId);
    await this.orderRepository.updateById(order.id, {
      ord_status: OrderStatus.RETURN_REQUESTED,
    });

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
        rfl_updated_at: new Date(),
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

  async markRefundNotReturned({ refundLogId, adminId, reason }) {
    const refundLog = await this.refundLogRepository.getById(
      convertToObjectIdMongodb(refundLogId)
    );
    if (!refundLog) {
      throw new NotFoundError(`Refund request ${refundLogId} not found`);
    }

    if (refundLog.rfl_status !== 'APPROVED') {
      throw new BadRequestError(
        'Refund request must be APPROVED to mark as not returned'
      );
    }

    const updatedRefundLog = await this.refundLogRepository.updateById(
      convertToObjectIdMongodb(refundLogId),
      {
        rfl_status: 'NOT_RETURNED',
        rfl_admin_id: convertToObjectIdMongodb(adminId),
        rfl_description: reason
          ? reason.trim()
          : 'Customer failed to return item',
        rfl_updated_at: new Date(),
      }
    );

    // ĐIỂM KHÁC BIỆT: Cập nhật ord_status
    const newOrderStatus = await this._determineOrderStatus(
      refundLog.rfl_order_id
    );
    await this.orderRepository.updateById(refundLog.rfl_order_id, {
      ord_status: newOrderStatus,
      ord_payment_status:
        newOrderStatus === OrderStatus.DELIVERED
          ? PaymentStatus.COMPLETED
          : PaymentStatus.PENDING_REFUND,
    });

    return {
      refundLogId: updatedRefundLog.id,
      status: updatedRefundLog.rfl_status,
    };
  }

  async confirmReturnReceived({ refundLogIds, adminId, ipAddress }) {
    if (
      !refundLogIds ||
      !Array.isArray(refundLogIds) ||
      refundLogIds.length === 0
    ) {
      throw new BadRequestError('At least one refundLogId is required');
    }

    let totalRefundAmount = 0;
    let orderId = null;
    const refundLogs = [];

    for (const refundLogId of refundLogIds) {
      const refundLog = await this.refundLogRepository.getById(
        convertToObjectIdMongodb(refundLogId)
      );
      if (!refundLog) {
        throw new NotFoundError(`Refund request ${refundLogId} not found`);
      }

      if (refundLog.status !== 'APPROVED') {
        throw new BadRequestError(
          `Refund request ${refundLogId} must be APPROVED`
        );
      }

      if (!orderId) {
        orderId = refundLog.rfl_order_id;
      } else if (orderId.toString() !== refundLog.rfl_order_id.toString()) {
        throw new BadRequestError(
          'All refund requests must belong to the same order'
        );
      }

      refundLogs.push(refundLog);
      totalRefundAmount += refundLog.rfl_amount;
    }

    const order = await this.orderRepository.getById(orderId);
    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }

    // ĐIỂM KHÁC BIỆT: Sử dụng processRefund từ PaymentService
    const { refundResult, paymentStatus } =
      await this.paymentService.processRefund({
        orderId,
        totalRefundAmount,
        refundLogIds,
        adminId,
        ipAddress,
        paymentMethod: order.paymentMethod,
      });

    // Cập nhật ord_status và ord_payment_status
    const newOrderStatus = await this._determineOrderStatus(orderId);
    await this.orderRepository.updateById(orderId, {
      ord_status: newOrderStatus,
      ord_payment_status: paymentStatus,
    });

    // Hoàn stock
    const itemsToRestock = refundLogs.map((log) => ({
      productId: log.rfl_item.prd_id,
      variantId: log.rfl_item.var_id,
      quantity: log.rfl_item.prd_quantity,
    }));
    await this.orderService._reverseStock(itemsToRestock);

    return {
      orderId,
      totalRefundAmount,
      status: refundResult?.status || 'COMPLETED',
      refundLogIds,
    };
  }

  async getRefundStatus(refundLogId) {
    const refundLog = await this.refundLogRepository.getById(refundLogId);
    if (!refundLog) {
      throw new NotFoundError(`Refund log ${refundLogId} not found`);
    }

    return {
      refundLogId: refundLog.id,
      orderId: refundLog.orderId,
      amount: refundLog.amount,
      status: refundLog.status,
      paymentTransactionId: refundLog.paymentTransactionId || null,
      item: refundLog.item,
      reason: refundLog.reason,
      description: refundLog.description,
      requestedAt: refundLog.requestedAt,
      completedAt: refundLog.completedAt,
    };
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

    const refundLogs = await this.refundLogRepository.getAll({
      filter,
      queryOptions: { sort: '-createdAt' }, // Không phân trang ở đây để nhóm
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

    // ĐIỂM KHÁC BIỆT: Nhóm theo orderId
    const groupedByOrder = refundLogs.reduce((acc, log) => {
      const orderIdStr = log.rfl_order_id._id.toString();
      if (!acc[orderIdStr]) {
        acc[orderIdStr] = {
          orderId: log.rfl_order_id._id,
          userId: log.rfl_order_id.ord_user_id?._id,
          orderStatus: log.rfl_order_id.ord_status,
          paymentMethod: log.rfl_order_id.ord_payment_method,
          refundRequests: [],
        };
      }
      acc[orderIdStr].refundRequests.push({
        id: log.id,
        amount: log.rfl_amount,
        status: log.rfl_status,
        reason: log.rfl_reason,
        description: log.rfl_description,
        item: {
          productId: log.rfl_item.prd_id._id,
          productName: log.rfl_item.prd_id.prd_name,
          variantId: log.rfl_item.var_id?._id,
          variantName: log.rfl_item.var_id?.var_name,
          quantity: log.rfl_item.prd_quantity,
        },
        admin: log.rfl_admin_id
          ? {
              name: log.rfl_admin_id.usr_name,
              email: log.rfl_admin_id.usr_email,
            }
          : null,
        requestedAt: log.rfl_requested_at,
        createdAt: log.createdAt,
      });
      return acc;
    }, {});

    // Chuyển object thành mảng và phân trang
    const orders = Object.values(groupedByOrder);
    const total = orders.length;
    const start = (page - 1) * size;
    const paginatedOrders = orders.slice(start, start + size);

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
      rfl_order_id: {
        $in: await this.orderRepository
          .getAll({ filter: { ord_user_id: convertToObjectIdMongodb(userId) } })
          .then((orders) => orders.map((order) => order.id)),
      },
    };
    if (orderId) {
      filter.rfl_order_id = convertToObjectIdMongodb(orderId);
    }

    const refundLogs = await this.refundLogRepository.getAll({
      filter,
      queryOptions: { sort: '-rfl_requested_at' },
      populateOptions: [
        {
          path: 'rfl_order_id',
          select: 'ord_user_id ord_status ord_payment_method',
        },
        { path: 'rfl_item.prd_id', select: 'prd_name prd_main_image' },
        { path: 'rfl_item.var_id', select: 'var_name var_slug' },
      ],
    });

    const groupedByOrder = refundLogs.reduce((acc, log) => {
      const orderIdStr = log.rfl_order_id._id.toString();
      if (!acc[orderIdStr]) {
        acc[orderIdStr] = {
          orderId: log.rfl_order_id._id,
          orderStatus: log.rfl_order_id.ord_status,
          paymentMethod: log.rfl_order_id.ord_payment_method,
          refundRequests: [],
        };
      }

      let userFriendlyStatus;
      if (log.rfl_status === 'COMPLETED') {
        userFriendlyStatus = 'Refunded';
      } else if (log.rfl_status === 'REJECTED') {
        userFriendlyStatus = 'Rejected';
      } else if (log.rfl_status === 'NOT_RETURNED') {
        userFriendlyStatus = 'Not Returned';
      } else {
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

    const orders = Object.values(groupedByOrder);
    const total = orders.length;
    const start = (page - 1) * size;
    const paginatedOrders = orders.slice(start, start + size);

    return listResponse({
      items: paginatedOrders,
      total,
      page,
      size,
    });
  }

  async getManualRequiredRefunds({ page = 1, size = 10, orderId }) {
    page = parseInt(page, 10) || 1;
    size = parseInt(size, 10) || 10;
    if (page < 1 || size < 1) {
      throw new BadRequestError('Invalid page or size');
    }

    // ĐIỂM KHÁC BIỆT: Lọc từ PaymentTransaction thay vì RefundLog
    const filter = {
      pmt_method: PaymentMethod.MANUAL,
      pmt_status: PaymentStatus.PENDING,
      pmt_type: TransactionType.REFUND,
    };
    if (orderId) filter.pmt_order_id = convertToObjectIdMongodb(orderId);

    const queryOptions = { sort: '-createdAt', page, size };
    const transactions = await this.paymentTransactionRepository.getAll({
      filter,
      queryOptions,
      populateOptions: [
        {
          path: 'pmt_order_id',
          select: 'ord_user_id ord_status ord_payment_method',
        },
        { path: 'pmt_admin_id', select: 'usr_name usr_email' },
      ],
    });

    const total = await this.paymentTransactionRepository.countDocuments(
      filter
    );

    // Lấy RefundLog liên quan (nếu có)
    const results = await Promise.all(
      transactions.map(async (transaction) => {
        const refundLogs = await this.refundLogRepository.getAll({
          filter: { rfl_payment_transaction_id: transaction.id },
          populateOptions: [
            { path: 'rfl_item.prd_id', select: 'prd_name prd_main_image' },
            { path: 'rfl_item.var_id', select: 'var_name var_slug' },
          ],
        });

        return {
          transactionId: transaction.id,
          orderId: transaction.orderId,
          userId: transaction.orderId?.ord_user_id?._id,
          amount: transaction.amount,
          paymentMethod: transaction.method,
          createdAt: transaction.createdAt,
          refundLogs: refundLogs.map((log) => ({
            id: log.id,
            status: log.status,
            reason: log.reason,
            description: log.description,
            item: {
              productId: log.item.prd_id,
              productName: log.item.prd_id?.prd_name,
              variantId: log.item.var_id,
              variantName: log.item.var_id?.var_name,
              quantity: log.item.prd_quantity,
            },
          })),
        };
      })
    );

    return listResponse({
      items: results,
      total,
      page,
      size,
    });
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
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestError('Order must be delivered to refund');
    }

    return order;
  }

  async _determineOrderStatus(orderId) {
    const allRefundLogs = await this.refundLogRepository.getAll({
      filter: { rfl_order_id: convertToObjectIdMongodb(orderId) },
    });

    if (allRefundLogs.length === 0) {
      return OrderStatus.DELIVERED; // Không có yêu cầu hoàn hàng
    }

    const hasActiveReturns = allRefundLogs.some((log) =>
      ['PENDING', 'APPROVED', 'COMPLETED'].includes(log.status)
    );

    const allCompleted = allRefundLogs.every(
      (log) => log.status === 'COMPLETED'
    );

    const allRejectedOrNotReturned = allRefundLogs.every((log) =>
      ['REJECTED', 'NOT_RETURNED'].includes(log.status)
    );

    if (allCompleted) {
      return OrderStatus.RETURNED;
    } else if (allRejectedOrNotReturned) {
      return OrderStatus.DELIVERED;
    } else if (hasActiveReturns) {
      return OrderStatus.RETURN_REQUESTED;
    }

    return OrderStatus.DELIVERED;
  }
}

module.exports = RefundService;
