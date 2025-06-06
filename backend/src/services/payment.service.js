'use strict';

const axios = require('axios');
const querystring = require('qs');
const moment = require('moment');
const { VNPAY_CONFIG, MOMO_CONFIG } = require('../constants/payment');
const {
  generateHmacSha256,
  generateHmacHash,
} = require('../helpers/crypto.helper');
const {
  BadRequestError,
  NotFoundError,
  InternalServerError,
} = require('../utils/errorResponse');
const {
  sortObject,
  listResponse,
  pickFields,
  omitFields,
  convertToObjectIdMongodb,
} = require('../utils/helpers');
const {
  OrderStatus,
  PaymentStatus,
  PaymentSessionStatus,
  PaymentMethod,
  PaymentGateway,
  TransactionType,
  RefundStatus,
} = require('../constants/status');
const OrderRepository = require('../repositories/order.repository');
const PaymentSessionRepository = require('../repositories/paymentSession.repository');
const PaymentTransactionRepository = require('../repositories/paymentTransaction.repository');
const RefundLogRepository = require('../repositories/refundLog.repository');

class PaymentService {
  constructor() {
    this.orderRepository = new OrderRepository();
    this.paymentSessionRepository = new PaymentSessionRepository();
    this.paymentTransactionRepository = new PaymentTransactionRepository();
    this.refundLogRepository = new RefundLogRepository();

    this.paymentSessionExpiry = 15 * 60 * 1000; // 15 minutes
  }

  // Done
  async createVNPayPaymentUrl({
    orderId,
    ipAddress,
    language = VNPAY_CONFIG.LOCALE_DEFAULT,
    bankCode = 'VNBANK',
    redirectUrl,
  }) {
    const order = await this._validateOrder(orderId, PaymentMethod.VNPAY);
    const existingSession = await this._getValidPaymentSession(
      orderId,
      PaymentGateway.VNPAY
    );

    if (existingSession) {
      return existingSession.paymentUrl;
    }

    const createDate = moment().format('YYYYMMDDHHmmss');
    const codeOrder = moment().format('DDHHmmss');
    const transactionId = `VNPAY_${orderId}_${codeOrder}`;

    const params = sortObject({
      vnp_Version: VNPAY_CONFIG.VERSION,
      vnp_Command: VNPAY_CONFIG.COMMAND,
      vnp_TmnCode: VNPAY_CONFIG.TMN_CODE,
      vnp_Locale: ['vn', 'en'].includes(language)
        ? language
        : VNPAY_CONFIG.LOCALE_DEFAULT,
      vnp_CurrCode: VNPAY_CONFIG.CURR_CODE,
      vnp_TxnRef: transactionId,
      vnp_OrderInfo: `Thanh toán đơn hàng ${orderId}`,
      vnp_OrderType: VNPAY_CONFIG.ORDER_TYPE,
      vnp_Amount: order.totalPrice * 100,
      vnp_ReturnUrl:
        redirectUrl ||
        `${process.env.BACKEND_URL}/api/v1/payment/vnpay/callback`,
      vnp_IpAddr: ipAddress,
      vnp_CreateDate: createDate,
      ...(bankCode && { vnp_BankCode: bankCode }),
    });

    const signData = querystring.stringify(params, { encode: false });
    params.vnp_SecureHash = generateHmacHash(signData, VNPAY_CONFIG.SECRET);

    const paymentUrl = `${VNPAY_CONFIG.URL}?${querystring.stringify(params, {
      encode: false,
    })}`;

    await this._createOrUpdatePaymentSession(
      orderId,
      PaymentGateway.VNPAY,
      paymentUrl,
      transactionId
    );
    await this.paymentTransactionRepository.create({
      pmt_order_id: orderId,
      pmt_transaction_id: transactionId,
      pmt_type: TransactionType.PAYMENT,
      pmt_method: PaymentMethod.VNPAY,
      pmt_amount: order.totalPrice,
      pmt_status: PaymentStatus.PENDING,
    });

    return paymentUrl;
  }

  // Done
  async verifyVNPayCallback(params) {
    const secureHash = params.vnp_SecureHash;
    delete params.vnp_SecureHash;
    delete params.vnp_SecureHashType;

    const sortedParams = sortObject(params);
    const signData = querystring.stringify(sortedParams, { encode: false });
    const expectedHash = generateHmacHash(signData, VNPAY_CONFIG.SECRET);

    if (secureHash !== expectedHash) {
      throw new BadRequestError('Invalid VNPay signature');
    }

    const isSuccess = params.vnp_TransactionStatus === '00';
    const orderId = params.vnp_TxnRef.split('_')[1];
    const transId = params.vnp_TxnRef;
    const amount = params.vnp_Amount / 100;

    const transaction = await this.paymentTransactionRepository.getByQuery({
      pmt_transaction_id: transId,
    });
    console.log(transaction);
    if (!transaction) {
      throw new NotFoundError(`Transaction ${transId} not found`);
    }

    if (isSuccess) {
      const paidAt = moment(params.vnp_PayDate, 'YYYYMMDDHHmmss').toDate();
      await this._updateOrderAndTransaction({
        orderId,
        transId,
        transactionId: transaction.id,
        method: PaymentGateway.VNPAY,
        status: PaymentStatus.COMPLETED,
        paidAt,
      });
    } else {
      await this._updateOrderAndTransaction({
        orderId,
        transId,
        transactionId: transaction.id,
        method: PaymentGateway.VNPAY,
        status: PaymentStatus.FAILED,
      });
    }

    return { isSuccess, orderId, amount };
  }

  // Done
  async createMoMoPaymentUrl({ orderId, ipAddress, redirectUrl }) {
    const order = await this._validateOrder(orderId, PaymentMethod.MOMO);
    const existingSession = await this._getValidPaymentSession(
      orderId,
      PaymentGateway.MOMO
    );

    if (existingSession) {
      return existingSession.paymentUrl;
    }

    const requestId = `${MOMO_CONFIG.PARTNER_CODE}${Date.now()}`;
    const transactionId = `MOMO_${orderId}_${Date.now()}`;

    const params = {
      partnerCode: MOMO_CONFIG.PARTNER_CODE,
      accessKey: MOMO_CONFIG.ACCESS_KEY,
      requestId,
      amount: order.totalPrice.toString(),
      orderId: transactionId,
      orderInfo: `Thanh toán đơn hàng ${orderId}`,
      redirectUrl:
        redirectUrl ||
        `${process.env.BACKEND_URL}/api/v1/payment/momo/callback`,
      ipnUrl: MOMO_CONFIG.IPN_URL,
      requestType: MOMO_CONFIG.REQUEST_TYPE,
      extraData: '',
      autoCapture: MOMO_CONFIG.AUTO_CAPTURE,
      lang: MOMO_CONFIG.LANG,
    };

    params.signature = this._generateMoMoSignature(params);

    const { data } = await axios.post(MOMO_CONFIG.API_URL, params);
    if (!data.payUrl) {
      throw new BadRequestError('Failed to create MoMo payment URL');
    }

    await this._createOrUpdatePaymentSession(
      orderId,
      PaymentGateway.MOMO,
      data.payUrl,
      requestId
    );
    await this.paymentTransactionRepository.create({
      pmt_order_id: orderId,
      pmt_transaction_id: transactionId,
      pmt_type: TransactionType.PAYMENT,
      pmt_method: PaymentMethod.MOMO,
      pmt_amount: order.totalPrice,
      pmt_status: PaymentStatus.PENDING,
    });

    return data.payUrl;
  }

  async verifyMoMoCallback(params) {
    const { orderId, resultCode, transId, amount } = params;

    const transactionId = orderId;
    const actualOrderId = transactionId.split('_')[1];
    const transaction = await this.paymentTransactionRepository.getByQuery({
      pmt_transaction_id: transactionId,
    });

    if (!transaction) {
      throw new NotFoundError(`Không tìm thấy giao dịch ${orderId}`);
    }

    const isSuccess = [0, 7000, 7002, 9000].includes(Number(resultCode));

    if (isSuccess) {
      await this._updateOrderAndTransaction({
        orderId: actualOrderId,
        transId: transactionId,
        transactionId: transaction.id,
        method: PaymentGateway.MOMO,
        status: PaymentStatus.COMPLETED,
        paidAt: new Date(),
      });
    } else {
      await this._updateOrderAndTransaction({
        orderId: actualOrderId,
        transId: transactionId,
        transactionId: transaction.id,
        method: PaymentGateway.MOMO,
        status: PaymentStatus.FAILED,
      });
    }

    return { isSuccess, orderId: actualOrderId, amount };
  }

  // Refund methods
  async refundMoMoPayment({ orderId, totalRefundAmount, adminId }) {
    const order = await this.orderRepository.getById(orderId);
    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }
    if (!order.isPaid) {
      throw new BadRequestError('Order is not paid');
    }

    const paymentTransaction =
      await this.paymentTransactionRepository.getByQuery({
        pmt_order_id: orderId,
        pmt_type: TransactionType.PAYMENT,
        pmt_method: PaymentMethod.MOMO,
        pmt_status: PaymentStatus.COMPLETED,
      });

    if (!paymentTransaction) {
      throw new NotFoundError('No completed MoMo transaction found');
    }

    const refundTransactionId = `MOMO_REFUND_${orderId}_${Date.now()}`;
    const params = this._buildMoMoRefundParams({
      orderId,
      refundTransactionId,
      amount: totalRefundAmount,
      transId: paymentTransaction.transactionId,
    });

    try {
      const { data } = await axios.post(MOMO_CONFIG.REFUND_URL, params);
      return await this._processMoMoRefundResponse({
        data,
        orderId,
        refundTransactionId,
        totalRefundAmount,
        adminId,
      });
    } catch (error) {
      const manualRefundTransaction = await this._createManualRefundTransaction(
        {
          orderId,
          totalRefundAmount,
          adminId,
        }
      );

      return {
        status: 'MANUAL_REQUIRED',
        message:
          'MoMo refund failed. Please process refund manually by providing bank details.',
        refundTransaction: manualRefundTransaction,
      };
    }
  }

  async refundVNPayPayment({ orderId, totalRefundAmount, adminId, ipAddress }) {
    const order = await this.orderRepository.getById(orderId);
    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }
    if (!order.isPaid) {
      throw new BadRequestError('Order is not paid');
    }

    const paymentTransaction =
      await this.paymentTransactionRepository.getByQuery({
        pmt_order_id: orderId,
        pmt_type: TransactionType.PAYMENT,
        pmt_method: PaymentMethod.VNPAY,
        pmt_status: PaymentStatus.COMPLETED,
      });

    if (!paymentTransaction) {
      throw new NotFoundError('No completed VNPay transaction found');
    }

    const refundTransactionId = `VNPAY_REFUND_${orderId}_${Date.now()}`;
    const params = this._buildVNPayRefundParams({
      orderId,
      amount: totalRefundAmount,
      transId: paymentTransaction.transactionId,
      paidAt: order.paidAt,
      ipAddress,
      refundTransactionId,
    });

    try {
      const refundUrl =
        'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';
      const { data } = await axios.post(refundUrl, params);

      return await this._processVNPayRefundResponse({
        data,
        orderId,
        refundTransactionId,
        totalRefundAmount,
        adminId,
      });
    } catch (error) {
      const manualRefundTransaction = await this._createManualRefundTransaction(
        {
          orderId,
          totalRefundAmount,
          adminId,
        }
      );

      return {
        status: 'MANUAL_REQUIRED',
        message:
          'VNPay refund failed. Please process refund manually by providing bank details.',
        refundTransaction: manualRefundTransaction,
      };
    }
  }

  async processCODRefund({
    orderId,
    totalRefundAmount,
    adminId,
    isCashRefund = false,
  }) {
    const order = await this.orderRepository.getById(
      convertToObjectIdMongodb(orderId)
    );
    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }
    if (!order.isPaid) {
      throw new BadRequestError('Order is not paid');
    }

    const paymentTransaction =
      await this.paymentTransactionRepository.getByQuery({
        pmt_order_id: convertToObjectIdMongodb(orderId),
        pmt_type: TransactionType.PAYMENT,
        pmt_method: PaymentMethod.COD,
        pmt_status: PaymentStatus.COMPLETED,
      });

    if (!paymentTransaction) {
      throw new NotFoundError('No completed COD transaction found');
    }

    if (isCashRefund) {
      const refundTransactionId = `COD_REFUND_${orderId}_${Date.now()}`;
      const refundTransaction = await this.paymentTransactionRepository.create({
        pmt_order_id: orderId,
        pmt_transaction_id: refundTransactionId,
        pmt_type: TransactionType.REFUND,
        pmt_method: PaymentMethod.COD,
        pmt_amount: totalRefundAmount,
        pmt_status: PaymentStatus.REFUNDED,
        pmt_admin_id: adminId,
        pmt_completed_at: new Date(),
      });

      await this._markOrderAsRefunded(orderId);

      return {
        status: 'COMPLETED',
        refundTransaction,
      };
    } else {
      const manualRefundTransaction = await this._createManualRefundTransaction(
        {
          orderId,
          totalRefundAmount,
          adminId,
        }
      );

      return {
        status: 'MANUAL_REQUIRED',
        message:
          'COD refund requires manual processing. Please provide bank details for refund.',
        refundTransaction: manualRefundTransaction,
      };
    }
  }

  async processManualRefund({
    paymentTransactionId,
    adminId,
    bankName,
    accountNumber,
    accountHolder,
    transferImage,
  }) {
    const transaction = await this.paymentTransactionRepository.getById(
      convertToObjectIdMongodb(paymentTransactionId)
    );

    if (!transaction) {
      throw new NotFoundError('Payment transaction not found');
    }

    if (transaction.status !== PaymentStatus.PENDING) {
      throw new BadRequestError(
        `Transaction must be in ${PaymentStatus.PENDING} refundStatus, current refundStatus: ${transaction.status}`
      );
    }

    const order = await this.orderRepository.getById(transaction.orderId);
    if (!order) {
      throw new NotFoundError(`Order ${transaction.orderId} not found`);
    }

    // Update PaymentTransaction
    const updatedTransaction =
      await this.paymentTransactionRepository.updateById(paymentTransactionId, {
        pmt_status: PaymentStatus.COMPLETED,
        pmt_admin_id: convertToObjectIdMongodb(adminId),
        pmt_bank_name: bankName,
        pmt_account_number: accountNumber,
        pmt_account_holder: accountHolder,
        pmt_bank_transfer_image: transferImage,
        pmt_completed_at: new Date(),
      });

    if (!updatedTransaction) {
      throw new InternalServerError('Failed to update payment transaction');
    }

    const refundIds =
      await this.refundLogRepository.getRefundLogByTransactionId(
        updatedTransaction.id
      );

    // Update RefundLogs for product returns (if provided)
    if (refundIds && refundIds.length > 0) {
      for (const refundId of refundIds) {
        await this.refundLogRepository.updateById(refundId.id, {
          rfl_status: RefundStatus.COMPLETED,
          rfl_manual_required: false,
          rfl_completed_at: new Date(),
        });
      }
    }

    // Update order payment refundStatus
    await this.orderRepository.updateById(order.id, {
      ord_payment_status: PaymentStatus.REFUNDED,
    });

    return {
      paymentTransactionId: updatedTransaction.id,
      totalRefundAmount: transaction.amount,
      refundStatus: updatedTransaction.status,
    };
  }

  async getTransactionDetails(transactionId) {
    try {
      const transaction = await this.paymentTransactionRepository.getById(
        transactionId,
        [
          {
            path: 'pmt_order_id',
            select: 'ord_user_id ord_status ord_payment_method ord_total_price',
          },
          { path: 'pmt_admin_id', select: 'usr_name usr_email' },
        ]
      );

      if (!transaction) {
        throw new NotFoundError(`Transaction ${transactionId} not found`);
      }

      // Lấy các refund log liên quan (nếu có)
      const refundLogs = await this.refundLogRepository.getAll({
        filter: { rfl_payment_transaction_id: transactionId },
        populateOptions: [
          { path: 'rfl_item.prd_id', select: 'prd_name prd_main_image' },
          { path: 'rfl_item.var_id', select: 'var_name var_slug' },
        ],
      });

      console.log(refundLogs);

      return {
        transactionId: transaction.id,
        orderId: transaction.orderId,
        amount: transaction.amount,
        paymentMethod: transaction.method,
        status: transaction.status,
        type: transaction.type,
        bankDetails: transaction.bankDetails,
        admin: transaction.admin,
        completedAt: transaction.completedAt,
        refundLogs: refundLogs.map((log) => ({
          id: log.id,
          status: log.status,
          reason: log.reason,
          description: log.description,
          amount: log.amount,
          item: {
            productId: log.item.productId,
            productName: log.item.productName,
            variantId: log.item.variantId,
            variantName: log.item.variantName,
            image: log.item.image,
            quantity: log.item.quantity,
          },
        })),
      };
    } catch (error) {
      throw new BadRequestError(
        `Failed to get transaction details: ${error.message}`
      );
    }
  }

  async getTransactionByAdmin({
    page = 1,
    size = 10,
    orderId,
    method,
    status,
    type,
  }) {
    page = parseInt(page, 10) || 1;
    size = parseInt(size, 10) || 10;
    if (page < 1 || size < 1) {
      throw new BadRequestError('Invalid page or size');
    }

    const filter = {};

    if (method) filter.pmt_method = method;
    if (status) filter.pmt_status = status;
    if (type) filter.pmt_type = type;
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

    return listResponse({
      items: transactions.map((transaction) => ({
        ...omitFields({
          fields: ['bankDetails', 'createdAt', 'updatedAt', 'orderId'],
          object: transaction,
        }),
      })),
      total,
      page,
      size,
    });
  }

  // Handle MoMo refund IPN
  async handleMoMoRefundIPN(params) {
    const { orderId, resultCode, transId, amount } = params;
    const transactionId = orderId;
    const transaction = await this.paymentTransactionRepository.getByQuery({
      filter: { pmt_transaction_id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundError(`Transaction ${transactionId} not found`);
    }

    const actualOrderId = transaction.orderId;

    if ([7000, 7002, 9000].includes(resultCode)) {
      return { status: 'PENDING', orderId: actualOrderId, amount };
    }

    if (resultCode === 0) {
      await this.paymentTransactionRepository.updateById(transaction.id, {
        pmt_status: PaymentStatus.REFUNDED,
        pmt_completed_at: new Date(),
      });
      await this._markOrderAsRefunded(actualOrderId);
    } else {
      const manualRefundTransaction = await this._createManualRefundTransaction(
        {
          orderId: actualOrderId,
          totalRefundAmount: amount,
          adminId: transaction.adminId,
        }
      );
      return {
        status: 'MANUAL_REQUIRED',
        message: `MoMo refund failed: ${params.message}`,
        refundTransaction: manualRefundTransaction,
      };
    }

    return { status: 'COMPLETED', orderId: actualOrderId, amount };
  }

  // Handle VNPay refund IPN
  async handleVNPayRefundIPN(params) {
    const secureHash = params.vnp_SecureHash;
    delete params.vnp_SecureHash;
    delete params.vnp_SecureHashType;

    const sortedParams = sortObject(params);
    const signData = querystring.stringify(sortedParams, { encode: false });
    const expectedHash = generateHmacHash(signData, VNPAY_CONFIG.SECRET);

    if (secureHash !== expectedHash) {
      throw new BadRequestError('Invalid VNPay IPN signature');
    }

    const transactionId = params.vnp_TxnRef;
    const orderId = transactionId.split('_')[1];
    const amount = params.vnp_Amount / 100;
    const responseCode = params.vnp_ResponseCode;

    const transaction = await this.paymentTransactionRepository.getByQuery({
      filter: { pmt_transaction_id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundError(`Transaction ${transactionId} not found`);
    }

    if (responseCode === '00') {
      await this.paymentTransactionRepository.updateById(transaction.id, {
        pmt_status: PaymentStatus.REFUNDED,
        pmt_completed_at: new Date(),
      });
      await this._markOrderAsRefunded(orderId);
    } else {
      const manualRefundTransaction = await this._createManualRefundTransaction(
        {
          orderId,
          totalRefundAmount: amount,
          adminId: transaction.adminId,
        }
      );
      return {
        status: 'MANUAL_REQUIRED',
        message: `VNPay refund failed: ${params.vnp_Message}`,
        refundTransaction: manualRefundTransaction,
      };
    }

    return { status: 'COMPLETED', orderId, amount };
  }

  // Payment processing methods
  async processCODPayment({ orderId, adminId }) {
    const order = await this.orderRepository.getById(orderId);
    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }
    if (order.paymentMethod !== PaymentMethod.COD) {
      throw new BadRequestError('Order is not a COD order');
    }

    const transactionId = `COD_${orderId}_${Date.now()}`;

    const transaction = await this.paymentTransactionRepository.create({
      pmt_order_id: orderId,
      pmt_transaction_id: transactionId,
      pmt_type: TransactionType.PAYMENT,
      pmt_method: PaymentMethod.COD,
      pmt_amount: order.totalPrice,
      pmt_status: PaymentStatus.PENDING,
      pmt_admin_id: adminId || null,
    });

    await this.orderRepository.updateById(orderId, {
      ord_payment_status: PaymentStatus.PENDING, // COD luôn PENDING
      ord_transaction_id: transactionId,
    });

    return transaction;
  }

  async confirmCODPayment({ orderId, adminId }) {
    const order = await this.orderRepository.getById(orderId);
    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }
    if (order.paymentMethod !== PaymentMethod.COD) {
      throw new BadRequestError('Order is not a COD order');
    }
    if (order.status !== OrderStatus.SHIPPED) {
      throw new BadRequestError(
        'Order must be delivered to confirm COD payment'
      );
    }

    const transaction = await this.paymentTransactionRepository.getByQuery({
      pmt_order_id: orderId,
      pmt_type: TransactionType.PAYMENT,
      pmt_method: PaymentMethod.COD,
      pmt_status: PaymentStatus.PENDING,
    });

    if (!transaction) {
      throw new NotFoundError(
        `No pending COD transaction found for order ${orderId}`
      );
    }

    await this.paymentTransactionRepository.updateById(transaction.id, {
      pmt_status: PaymentStatus.COMPLETED,
      pmt_completed_at: new Date(),
      pmt_admin_id: adminId,
    });

    await this.orderRepository.updateById(orderId, {
      ord_payment_status: PaymentStatus.COMPLETED,
      ord_is_paid: true,
      ord_paid_at: new Date(),
    });

    return transaction;
  }

  async processManualPayment({
    orderId,
    adminId,
    bankName,
    accountNumber,
    accountHolder,
    transferImage,
  }) {
    await this._validateOrder(orderId, PaymentMethod.COD);
    const transaction = await this.paymentTransactionRepository.getByQuery({
      pmt_order_id: orderId,
      pmt_type: TransactionType.PAYMENT,
      pmt_method: PaymentMethod.COD,
      pmt_status: PaymentStatus.PENDING,
    });

    if (!transaction) {
      throw new NotFoundError(
        `No pending COD transaction found for order ${orderId}`
      );
    }

    await this.paymentTransactionRepository.updateById(transaction.id, {
      pmt_status: PaymentStatus.COMPLETED,
      pmt_admin_id: adminId,
      pmt_completed_at: new Date(),
      pmt_bank_name: bankName,
      pmt_account_number: accountNumber,
      pmt_account_holder: accountHolder,
      pmt_bank_transfer_image: transferImage,
    });

    await this.orderRepository.updateById(orderId, {
      ord_is_paid: true,
      ord_paid_at: new Date(),
      ord_payment_status: PaymentStatus.COMPLETED,
    });

    return transaction;
  }

  // Resend payment URL
  async resendPaymentUrl({ orderId, userId, ipAddress }) {
    const order = await this.orderRepository.getById(orderId);
    if (!order || order.userId.toString() !== userId.toString()) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }

    if (order.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new BadRequestError('Order is not in AWAITING_PAYMENT status');
    }

    if (order.paymentMethod === PaymentMethod.VNPAY) {
      return await this.createVNPayPaymentUrl({ orderId, ipAddress });
    } else if (order.paymentMethod === PaymentMethod.MOMO) {
      return await this.createMoMoPaymentUrl({ orderId, ipAddress });
    } else {
      throw new BadRequestError(
        'Payment method does not support resending URL'
      );
    }
  }

  // Helper methods

  async _updateOrderAndTransaction({
    orderId,
    transId,
    transactionId,
    method,
    status,
    paidAt = new Date(),
  }) {
    if (status === PaymentStatus.COMPLETED) {
      await this._markOrderAsPaid(orderId, transId, paidAt);
      await this.paymentTransactionRepository.updateById(transactionId, {
        pmt_status: status,
        pmt_completed_at: paidAt,
      });
      await this.paymentSessionRepository.updateByQuery(
        {
          filter: {
            pms_order_id: orderId,
            pms_payment_method: method,
            pms_status: PaymentSessionStatus.PENDING,
          },
        },
        {
          pms_status: PaymentSessionStatus.COMPLETED,
          pms_transaction_id: transId,
        }
      );
    } else {
      await this.orderRepository.updateById(orderId, {
        ord_payment_status: PaymentStatus.FAILED,
        ord_status: OrderStatus.AWAITING_PAYMENT,
      });
      await this.paymentTransactionRepository.updateById(transactionId, {
        pmt_status: status,
      });
      await this.paymentSessionRepository.updateByQuery(
        {
          filter: {
            pms_order_id: orderId,
            pms_payment_method: method,
            pms_status: PaymentSessionStatus.PENDING,
          },
        },
        { pms_status: PaymentSessionStatus.FAILED }
      );
    }
  }

  async _validateOrder(orderId, paymentMethod) {
    const order = await this.orderRepository.getById(orderId);
    if (!order) {
      throw new NotFoundError(`Không tìm thấy đơn hàng ${orderId}`);
    }
    if (order.isPaid) {
      throw new BadRequestError('Đơn hàng đã được thanh toán');
    }
    if (order.paymentMethod !== paymentMethod) {
      throw new BadRequestError(
        'Phương thức thanh toán không khớp với đơn hàng'
      );
    }
    return order;
  }

  async _validatePaidOrder(orderId) {
    const order = await this.orderRepository.getById(orderId);
    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }
    if (!order.isPaid) {
      throw new BadRequestError('Order not paid');
    }
    return order;
  }

  async _validatePaymentTransaction(orderId, paymentMethod) {
    const transaction = await this.paymentTransactionRepository.getByQuery({
      pmt_order_id: orderId,
      pmt_type: TransactionType.PAYMENT,
      pmt_method: paymentMethod,
      pmt_status: PaymentStatus.COMPLETED,
    });
    if (!transaction) {
      throw new NotFoundError(
        `Không tìm thấy giao dịch thanh toán hợp lệ cho đơn hàng ${orderId}`
      );
    }
    return transaction;
  }

  async _markOrderAsPaid(orderId, transactionId, paidAt = new Date()) {
    const updatedOrder = await this.orderRepository.updateById(orderId, {
      ord_is_paid: true,
      ord_paid_at: paidAt,
      ord_status: OrderStatus.PROCESSING,
      ord_payment_status: PaymentStatus.COMPLETED,
      ord_transaction_id: transactionId,
    });
    if (!updatedOrder) {
      throw new BadRequestError('Failed to mark order as paid');
    }
  }

  async _getValidPaymentSession(orderId, paymentMethod) {
    const session = await this.paymentSessionRepository.getByQuery({
      pms_order_id: orderId,
      pms_payment_method: paymentMethod,
      pms_status: PaymentSessionStatus.PENDING,
      pms_expires_at: { $gt: new Date() },
    });
    if (session && (session.retryCount || 0) >= 5) {
      throw new BadRequestError('Max retry limit reached');
    }
    return session;
  }

  async _createOrUpdatePaymentSession(
    orderId,
    paymentMethod,
    paymentUrl,
    requestId = null
  ) {
    const existingSession = await this.paymentSessionRepository.getByQuery({
      pms_order_id: orderId,
      pms_payment_method: paymentMethod,
      pms_status: PaymentSessionStatus.PENDING,
    });

    if (existingSession) {
      const session = await this.paymentSessionRepository.updateById(
        existingSession.id,
        {
          pms_payment_url: paymentUrl,
          pms_expires_at: new Date(Date.now() + this.paymentSessionExpiry),
          pms_retry_count: (existingSession.retryCount || 0) + 1,
          pms_status: PaymentSessionStatus.PENDING,
          ...(requestId && { pms_request_id: requestId }),
        }
      );
      return session;
    }

    const newSession = await this.paymentSessionRepository.create({
      pms_order_id: orderId,
      pms_payment_method: paymentMethod,
      pms_payment_url: paymentUrl,
      pms_expires_at: new Date(Date.now() + this.paymentSessionExpiry),
      pms_status: PaymentSessionStatus.PENDING,
      pms_retry_count: 0,
      ...(requestId && { pms_request_id: requestId }),
    });

    return newSession;
  }

  _generateMoMoSignature(params, isRefund = false) {
    const fields = isRefund
      ? [
          'accessKey',
          'amount',
          'description',
          'orderId',
          'partnerCode',
          'requestId',
          'transId',
        ]
      : [
          'accessKey',
          'amount',
          'extraData',
          'ipnUrl',
          'orderId',
          'orderInfo',
          'partnerCode',
          'redirectUrl',
          'requestId',
          'requestType',
        ];
    const rawSignature = fields
      .map((key) => `${key}=${params[key] || ''}`)
      .join('&');
    return generateHmacSha256(rawSignature, MOMO_CONFIG.SECRET_KEY);
  }

  _verifyMoMoSignature(params) {
    const receivedSignature = params.signature;
    const rawSignature = [
      `accessKey=${MOMO_CONFIG.ACCESS_KEY}`,
      `amount=${params.amount || ''}`,
      `extraData=${params.extraData || ''}`,
      `message=${params.message || ''}`,
      `orderId=${params.orderId || ''}`,
      `orderInfo=${params.orderInfo || ''}`,
      `orderType=${params.orderType || ''}`,
      `partnerCode=${MOMO_CONFIG.PARTNER_CODE}`,
      `payType=${params.payType || ''}`,
      `requestId=${params.requestId || ''}`,
      `responseTime=${params.responseTime || ''}`,
      `resultCode=${params.resultCode || ''}`,
      `transId=${params.transId || ''}`,
    ].join('&');
    const expectedSignature = generateHmacSha256(
      rawSignature,
      MOMO_CONFIG.SECRET_KEY
    );
    return receivedSignature === expectedSignature;
  }

  _buildVNPayRefundParams({
    orderId,
    amount,
    transId,
    paidAt,
    ipAddress,
    refundTransactionId,
  }) {
    const createDate = moment().format('YYYYMMDDHHmmss');
    const vnp_TransactionType = '02';
    const vnp_CreateBy = 'System';

    const params = sortObject({
      vnp_Version: VNPAY_CONFIG.VERSION,
      vnp_Command: 'refund',
      vnp_TmnCode: VNPAY_CONFIG.TMN_CODE.TPENDING,
      vnp_TransactionType,
      vnp_TxnRef: refundTransactionId,
      vnp_Amount: amount * 100,
      vnp_TransactionNo: transId,
      vnp_TransactionDate: moment(paidAt).format('YYYYMMDDHHmmss'),
      vnp_CreateBy: vnp_CreateBy,
      vnp_CreateDate: createDate,
      vnp_IpAddr: ipAddress || '127.0.0.1',
      vnp_OrderInfo: `Refund for order ${orderId}`,
    });

    const signData = querystring.stringify(params, { encode: false });
    params.vnp_SecureHash = generateHmacHash(signData, VNPAY_CONFIG.SECRET);
    return params;
  }

  _buildMoMoRefundParams({ orderId, refundTransactionId, amount, transId }) {
    const requestId = `${MOMO_CONFIG.PARTNER_CODE}${Date.now()}`;
    const params = {
      partnerCode: MOMO_CONFIG.PARTNER_CODE,
      accessKey: MOMO_CONFIG.ACCESS_KEY,
      requestId,
      orderId: refundTransactionId,
      transId,
      amount: amount.toString(),
      description: `Refund for order ${orderId}`,
      requestType: 'refund',
    };
    params.signature = this._generateMoMoSignature(params, true);
    return params;
  }

  async _processMoMoRefundResponse({
    data,
    orderId,
    refundTransactionId,
    totalRefundAmount,
    adminId,
  }) {
    if ([7000, 7002, 9000].includes(data.resultCode)) {
      const manualRefundTransaction = await this._createManualRefundTransaction(
        {
          orderId: orderId,
          totalRefundAmount,
          adminId: adminId,
        }
      );

      return {
        status: 'PENDING_REFUSED',
        refundTransaction: manualRefundTransaction.id,
      };
    }

    if (data.resultCode !== 0) {
      const manualRefundTransaction = await this._createManualRefundTransaction(
        {
          orderId: orderId,
          totalRefundAmount: totalRefundAmount,
          adminId: adminId,
        }
      );

      return {
        status: 'MANUAL_REQUIRED',
        refundTransaction: manualRefundTransaction,
      };
    }

    const refundTransaction = await this.paymentTransactionRepository.create({
      pmt_order_id: orderId,
      pmt_transaction_id: refundTransactionId,
      pmt_type: TransactionType.REFUND,
      pmt_method: PaymentMethod.MOMO,
      pmt_amount: totalRefundAmount,
      pmt_status: PaymentStatus.REFUNDED,
      pmt_admin_id: adminId,
      pmt_completed_at: new Date(),
    });

    await this._markOrderAsRefunded(orderId);

    return {
      status: 'COMPLETED',
      refundTransaction,
    };
  }

  async _processVNPayRefundResponse({
    data,
    orderId,
    refundTransactionId,
    totalRefundAmount,
    adminId,
  }) {
    if (data.vnp_ResponseCode !== '00') {
      const manualRefundTransaction = await this._createManualRefundTransaction(
        {
          orderId: orderId,
          totalRefundAmount: totalRefundAmount,
          adminId: adminId,
        }
      );

      return {
        status: 'MANUAL_REQUIRED',
        refundTransaction: manualRefundTransaction,
      };
    }
    const refundTransaction = await this.paymentTransactionRepository.create({
      pmt_order_id: orderId,
      pmt_transaction_id: refundTransactionId,
      pmt_type: TransactionType.REFUND,
      pmt_method: PaymentMethod.VNPAY,
      pmt_amount: totalRefundAmount,
      pmt_status: PaymentStatus.REFUNDED,
      pmt_admin_id: adminId,
      pmt_completed_at: new Date(),
    });

    await this._markOrderAsRefunded(orderId);

    return {
      status: 'COMPLETED',
      refundTransaction,
    };
  }

  async _markOrderAsRefunded(orderId) {
    await this.orderRepository.updateById(orderId, {
      ord_payment_status: PaymentStatus.REFUNDED,
    });
  }

  async _createManualRefundTransaction({
    orderId,
    totalRefundAmount,
    adminId,
  }) {
    const existingTransaction =
      await this.paymentTransactionRepository.getByQuery({
        pmt_order_id: convertToObjectIdMongodb(orderId),
        pmt_status: PaymentStatus.PENDING,
      });

    console.log(existingTransaction);

    if (existingTransaction) {
      return existingTransaction;
    }

    console.log(orderId);

    const refundTransactionId = `MANUAL_REFUND_${orderId}_${Date.now()}`;
    const refund = await this.paymentTransactionRepository.create({
      pmt_order_id: convertToObjectIdMongodb(orderId),
      pmt_transaction_id: refundTransactionId,
      pmt_type: TransactionType.REFUND,
      pmt_method: PaymentMethod.MANUAL,
      pmt_amount: totalRefundAmount,
      pmt_status: PaymentStatus.PENDING,
      pmt_admin_id: convertToObjectIdMongodb(adminId) || null,
    });
    console.log(refund);
    return refund;
  }
}

module.exports = PaymentService;
