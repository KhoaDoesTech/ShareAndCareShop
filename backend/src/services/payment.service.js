'use strict';

const axios = require('axios');
const querystring = require('qs');
const moment = require('moment');
const { VNPAY_CONFIG, MOMO_CONFIG } = require('../constants/payment');
const {
  generateHmacSha256,
  generateHmacHash,
} = require('../helpers/crypto.helper');
const { BadRequestError, NotFoundError } = require('../utils/errorResponse');
const { sortObject } = require('../utils/helpers');
const {
  OrderStatus,
  PaymentStatus,
  PaymentGatewayMethods,
  PaymentSessionStatus,
  PaymentMethod,
} = require('../constants/status');
const OrderRepository = require('../repositories/order.repository');
const PaymentSessionRepository = require('../repositories/paymentSession.repository');

class PaymentService {
  constructor() {
    this.orderRepository = new OrderRepository();
    this.paymentSessionRepository = new PaymentSessionRepository();
    this.vnpTmnCode = process.env.VNPAY_TMN_CODE;
    this.vnpHashSecret = process.env.VNPAY_SECRET;
    this.vnpUrl = process.env.VNPAY_URL;
    this.momoPartnerCode = process.env.MOMO_PARTNER_CODE;
    this.momoAccessKey = process.env.MOMO_ACCESS_KEY;
    this.momoSecretKey = process.env.MOMO_SECRET_KEY;
    this.momoApiUrl = process.env.MOMO_API_URL;
    this.momoRefundUrl = process.env.MOMO_REFUND_URL;
    this.momoIpnUrl = process.env.MOMO_IPN_URL;
    this.paymentSessionExpiry = 15 * 60 * 1000; // 15 minutes
  }

  async createVNPayPaymentUrl({
    orderId,
    ipAddress,
    language = VNPAY_CONFIG.LOCALE_DEFAULT,
    bankCode = 'VNBANK',
    redirectUrl,
  }) {
    const order = await this._validateOrder(orderId);
    const existingSession = await this._getValidPaymentSession(
      orderId,
      PaymentGatewayMethods.VNPAY
    );

    if (existingSession) {
      return existingSession.paymentUrl;
    }

    const createDate = moment().format('YYYYMMDDHHmmss');
    const codeOrder = moment().format('DDHHmmss');

    const params = sortObject({
      vnp_Version: VNPAY_CONFIG.VERSION,
      vnp_Command: VNPAY_CONFIG.COMMAND,
      vnp_TmnCode: this.vnpTmnCode,
      vnp_Locale: ['vn', 'en'].includes(language)
        ? language
        : VNPAY_CONFIG.LOCALE_DEFAULT,
      vnp_CurrCode: VNPAY_CONFIG.CURR_CODE,
      vnp_TxnRef: orderId.toString(),
      vnp_OrderInfo: `Thanh toán đơn hàng: ${codeOrder}`,
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
    params.vnp_SecureHash = generateHmacHash(signData, this.vnpHashSecret);

    const paymentUrl = `${this.vnpUrl}?${querystring.stringify(params, {
      encode: false,
    })}`;
    await this._createOrUpdatePaymentSession(
      orderId,
      PaymentGatewayMethods.VNPAY,
      paymentUrl
    );

    return paymentUrl;
  }

  async verifyVNPayCallback(params) {
    const secureHash = params.vnp_SecureHash;
    delete params.vnp_SecureHash;
    delete params.vnp_SecureHashType;

    const sortedParams = sortObject(params);
    const signData = querystring.stringify(sortedParams, { encode: false });
    const expectedHash = generateHmacHash(signData, this.vnpHashSecret);

    if (secureHash !== expectedHash) {
      throw new BadRequestError('Invalid VNPay signature');
    }

    const isSuccess = params.vnp_TransactionStatus === '00';
    const orderId = params.vnp_TxnRef;

    if (isSuccess) {
      await this._markOrderAsPaid(orderId, params.vnp_TransactionNo);
      await this.paymentSessionRepository.updateByQuery(
        {
          filter: {
            orderId: orderId,
            paymentMethod: PaymentGatewayMethods.VNPAY,
            status: PaymentSessionStatus.PENDING,
          },
        },
        {
          pms_status: PaymentSessionStatus.COMPLETED,
          pms_transaction_id: params.vnp_TransactionNo,
        }
      );
    } else {
      await this.orderRepository.updateById(orderId, {
        ord_payment_status: PaymentStatus.FAILED,
        ord_status: OrderStatus.CANCELLED,
      });
      await this.paymentSessionRepository.updateByQuery(
        {
          filter: {
            orderId: orderId,
            paymentMethod: PaymentGatewayMethods.VNPAY,
            status: PaymentSessionStatus.PENDING,
          },
        },
        {
          pms_status: PaymentSessionStatus.FAILED,
        }
      );
    }

    return { isSuccess, orderId, amount: params.vnp_Amount / 100 };
  }

  async createMoMoPaymentUrl({ orderId, ipAddress, redirectUrl }) {
    const order = await this._validateOrder(orderId);
    const existingSession = await this._getValidPaymentSession(
      orderId,
      PaymentGatewayMethods.MOMO
    );

    if (existingSession) {
      return existingSession.paymentUrl;
    }

    const requestId = `${this.momoPartnerCode}${Date.now()}`;
    const uniqueOrderId = `${orderId}`;

    const params = {
      partnerCode: this.momoPartnerCode,
      accessKey: this.momoAccessKey,
      requestId,
      amount: order.totalPrice.toString(),
      orderId: uniqueOrderId,
      orderInfo: MOMO_CONFIG.ORDER_INFO,
      redirectUrl:
        redirectUrl ||
        `${process.env.FRONTEND_URL}/payment/success?orderId=${orderId}`,
      ipnUrl: this.momoIpnUrl,
      requestType: MOMO_CONFIG.REQUEST_TYPE,
      extraData: '',
      autoCapture: MOMO_CONFIG.AUTO_CAPTURE,
      lang: MOMO_CONFIG.LANG,
    };

    params.signature = this._generateMoMoSignature(params);

    const { data } = await axios.post(this.momoApiUrl, params);
    console.log(data);
    if (!data.payUrl) {
      throw new BadRequestError('Failed to create MoMo payment URL');
    }

    await this._createOrUpdatePaymentSession(
      orderId,
      PaymentGatewayMethods.MOMO,
      data.payUrl,
      uniqueOrderId
    );
    return data.payUrl;
  }

  async verifyMoMoCallback(params) {
    const { orderId, resultCode, transId } = params;
    if (!this._verifyMoMoSignature(params)) {
      throw new BadRequestError('Invalid MoMo signature');
    }

    const isSuccess = resultCode === 0;
    const baseOrderId = orderId.split('-')[0];

    if (isSuccess) {
      await this._markOrderAsPaid(baseOrderId, transId);
      await this.paymentSessionRepository.updateByQuery(
        {
          filter: {
            orderId: baseOrderId,
            paymentMethod: PaymentGatewayMethods.MOMO,
            status: PaymentSessionStatus.PENDING,
          },
        },
        {
          pms_status: PaymentSessionStatus.COMPLETED,
          pms_transaction_id: transId,
        }
      );
    } else {
      await this.orderRepository.updateById(baseOrderId, {
        ord_payment_status: PaymentStatus.FAILED,
        ord_status: OrderStatus.CANCELLED,
      });
      await this.paymentSessionRepository.updateByQuery(
        {
          filter: {
            orderId: baseOrderId,
            paymentMethod: PaymentGatewayMethods.MOMO,
            status: PaymentSessionStatus.PENDING,
          },
        },
        {
          pms_status: PaymentSessionStatus.FAILED,
        }
      );
    }

    return { isSuccess, orderId: baseOrderId, amount: params.amount };
  }

  async refundMoMoPayment({ orderId, amount, transId }) {
    const order = await this._validatePaidOrder(orderId);
    if (order.totalPrice !== amount) {
      throw new BadRequestError('Refund amount does not match order total');
    }

    const requestId = `${this.momoPartnerCode}${Date.now()}`;
    const params = {
      partnerCode: this.momoPartnerCode,
      accessKey: this.momoAccessKey,
      requestId,
      orderId,
      transId,
      amount: amount.toString(),
      description: `Refund for order ${orderId}`,
      requestType: 'refund',
    };

    params.signature = this._generateMoMoSignature(params, true);

    const { data } = await axios.post(this.momoRefundUrl, params);
    if (data.resultCode !== 0) {
      throw new BadRequestError(`MoMo refund failed: ${data.message}`);
    }

    await this.orderRepository.updateById(orderId, {
      ord_status: OrderStatus.REFUNDED,
      ord_payment_status: PaymentStatus.REFUNDED,
    });

    return data;
  }

  async refundVNPayPayment({ orderId, amount, transId, ipAddress }) {
    const order = await this._validatePaidOrder(orderId);
    if (order.totalPrice !== amount) {
      throw new BadRequestError('Refund amount does not match order total');
    }

    const createDate = moment().format('YYYYMMDDHHmmss');
    const vnp_TransactionType = '02';
    const vnp_TxnRef = `${orderId}_${Date.now()}`;
    const vnp_CreateBy = 'System';

    const params = sortObject({
      vnp_Version: VNPAY_CONFIG.VERSION,
      vnp_Command: 'refund',
      vnp_TmnCode: this.vnpTmnCode,
      vnp_TransactionType,
      vnp_TxnRef,
      vnp_Amount: amount * 100,
      vnp_TransactionNo: transId,
      vnp_TransactionDate: moment(order.paidAt).format('YYYYMMDDHHmmss'),
      vnp_CreateBy,
      vnp_CreateDate: createDate,
      vnp_IpAddr: ipAddress || '127.0.0.1',
      vnp_OrderInfo: `Refund for order ${orderId}`,
    });

    const signData = querystring.stringify(params, { encode: false });
    params.vnp_SecureHash = generateHmacHash(signData, this.vnpHashSecret);

    const refundUrl =
      'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';
    const { data } = await axios.post(refundUrl, params);
    if (data.vnp_ResponseCode !== '00') {
      throw new BadRequestError(`VNPay refund failed: ${data.vnp_Message}`);
    }

    await this.orderRepository.updateById(orderId, {
      ord_status: OrderStatus.PENDING_REFUND,
      ord_payment_status: PaymentStatus.PENDING_REFUND,
    });

    return {
      message: 'VNPay refund successful',
      transactionId: data.vnp_TransactionNo,
    };
  }

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
      throw new BadRequestError('Invalid payment method for resending URL');
    }
  }

  async refundPayment({ orderId, amount, transId, paymentMethod }) {
    if (paymentMethod === PaymentMethod.VNPAY) {
      return await this.refundVNPayPayment({ orderId, amount, transId });
    } else if (paymentMethod === PaymentMethod.MOMO) {
      return await this.refundMoMoPayment({ orderId, amount, transId });
    } else {
      throw new BadRequestError('Unsupported payment method for refund');
    }
  }

  async _validateOrder(orderId) {
    const order = await this.orderRepository.getById(orderId);
    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }
    if (order.isPaid) {
      throw new BadRequestError('Order is already paid');
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

  async _markOrderAsPaid(orderId, transId) {
    const order = await this._validateOrder(orderId);
    const updatedOrder = await this.orderRepository.updateById(order.id, {
      ord_is_paid: true,
      ord_paid_at: new Date(),
      ord_status: OrderStatus.PROCESSING,
      ord_payment_status: PaymentStatus.COMPLETED,
      ord_transaction_id: transId,
    });
    if (!updatedOrder) {
      throw new BadRequestError('Failed to mark order as paid');
    }
  }

  async _getValidPaymentSession(orderId, paymentMethod) {
    const session = await this.paymentSessionRepository.getByQuery({
      filter: {
        orderId: orderId,
        paymentMethod: paymentMethod,
        status: PaymentSessionStatus.PENDING,
        expiresAt: { $gt: new Date() },
      },
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
      filter: {
        orderId: orderId,
        paymentMethod: paymentMethod,
        status: PaymentSessionStatus.PENDING,
      },
    });

    if (existingSession) {
      return await this.paymentSessionRepository.updateById(
        existingSession.id,
        {
          pms_payment_url: paymentUrl,
          pms_expires_at: new Date(Date.now() + this.paymentSessionExpiry),
          pms_retry_count: (existingSession.retryCount || 0) + 1,
          pms_status: PaymentSessionStatus.PENDING,
          ...(requestId && { pms_request_id: requestId }),
        }
      );
    }

    return await this.paymentSessionRepository.create({
      pms_order_id: orderId,
      pms_payment_method: paymentMethod,
      pms_payment_url: paymentUrl,
      pms_expires_at: new Date(Date.now() + this.paymentSessionExpiry),
      pms_status: PaymentSessionStatus.PENDING,
      pms_retry_count: 0,
      ...(requestId && { pms_request_id: requestId }),
    });
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
    return generateHmacSha256(rawSignature, this.momoSecretKey);
  }

  _verifyMoMoSignature(params) {
    const receivedSignature = params.signature;
    const fields = [
      'accessKey',
      'amount',
      'extraData',
      'message',
      'orderId',
      'orderInfo',
      'orderType',
      'partnerCode',
      'payType',
      'requestId',
      'responseTime',
      'resultCode',
      'transId',
    ];
    const rawSignature = fields
      .map((key) => `${key}=${params[key] || ''}`)
      .join('&');
    const expectedSignature = generateHmacSha256(
      rawSignature,
      this.momoSecretKey
    );
    return receivedSignature === expectedSignature;
  }
}

module.exports = PaymentService;
