'use strict';

const axios = require('axios');
const querystring = require('qs');
const moment = require('moment');
const {
  VNPAY_CONFIG,
  MOMO_CONFIG,
  ORDER_STATUSES,
} = require('../constants/payment');
const {
  generateHmacSha256,
  generateHmacHash,
} = require('../helpers/crypto.helper');
const OrderRepository = require('../repositories/order.repository');
const {
  BadRequestError,
  NotFoundError,
  InternalServerError,
} = require('../utils/errorResponse');
const { sortObject } = require('../utils/helpers');
const { OrderStatus } = require('../constants/status');

class PaymentService {
  constructor() {
    this.orderRepository = new OrderRepository();

    this.vnpTmnCode = process.env.VNPAY_TMN_CODE;
    this.vnpHashSecret = process.env.VNPAY_SECRET;
    this.vnpUrl = process.env.VNPAY_URL;

    this.momoPartnerCode = process.env.MOMO_PARTNER_CODE;
    this.momoAccessKey = process.env.MOMO_ACCESS_KEY;
    this.momoSecretKey = process.env.MOMO_SECRET_KEY;
    this.momoApiUrl = process.env.MOMO_API_URL;
    this.momoRefundUrl = process.env.MOMO_REFUND_URL;
    this.momoRedirectUrl = process.env.MOMO_REDIRECT_URL;
    this.momoIpnUrl = process.env.MOMO_IPN_URL;
  }

  async createVNPayPaymentUrl({
    orderId,
    ipAddress,
    language = VNPAY_CONFIG.LOCALE_DEFAULT,
    bankCode = 'VNBANK',
  }) {
    const order = await this._validateOrder(orderId);
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
      vnp_TxnRef: orderId,
      vnp_OrderInfo: `Thanh toan cho ma GD:${codeOrder}`,
      vnp_OrderType: VNPAY_CONFIG.ORDER_TYPE,
      vnp_Amount: order.totalPrice * 100,
      vnp_ReturnUrl: `${process.env.BACKEND_URL}/api/v1/payment/vnpay/callback`,
      vnp_IpAddr: ipAddress,
      vnp_CreateDate: createDate,
      ...(bankCode && { vnp_BankCode: bankCode }),
    });

    const signData = querystring.stringify(params, { encode: false });
    params.vnp_SecureHash = generateHmacHash(signData, this.vnpHashSecret);

    return `${this.vnpUrl}?${querystring.stringify(params, { encode: false })}`;
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
    if (isSuccess) {
      await this._markOrderAsPaid(params.vnp_TxnRef, params.vnp_TransactionNo);
    }

    return {
      isSuccess,
      orderId: params.vnp_TxnRef,
      amount: params.vnp_Amount / 100,
      transactionNo: params.vnp_TransactionNo,
    };
  }

  async createMoMoPaymentUrl({ orderId, ipAddress }) {
    const order = await this._validateOrder(orderId);
    const requestId = `${this.momoPartnerCode}${Date.now()}`;

    const params = {
      partnerCode: this.momoPartnerCode,
      accessKey: this.momoAccessKey,
      requestId,
      amount: order.totalPrice.toString(),
      orderId,
      orderInfo: MOMO_CONFIG.ORDER_INFO,
      redirectUrl: this.momoRedirectUrl,
      ipnUrl: this.momoIpnUrl,
      requestType: MOMO_CONFIG.REQUEST_TYPE,
      extraData: '',
      autoCapture: MOMO_CONFIG.AUTO_CAPTURE,
      lang: MOMO_CONFIG.LANG,
    };

    params.signature = this._generateMoMoSignature(params);

    try {
      const { data } = await axios.post(this.momoApiUrl, params);
      console.log(data);
      if (!data.payUrl) {
        throw new BadRequestError('Failed to create MoMo payment URL');
      }
      return data.payUrl;
    } catch (error) {
      throw new BadRequestError(`MoMo API error: ${error.message}`);
    }
  }

  async verifyMoMoCallback(params) {
    const { orderId, resultCode, transId, amount, message } = params;

    if (!this._verifyMoMoSignature(params)) {
      throw new BadRequestError('Invalid MoMo signature');
    }

    const isSuccess = resultCode === 0;
    if (isSuccess) {
      await this._markOrderAsPaid(orderId, transId);
    }

    return {
      isSuccess,
      orderId,
      amount,
      transId,
      message,
    };
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

    try {
      const { data } = await axios.post(this.momoRefundUrl, params);
      if (data.resultCode !== 0) {
        throw new BadRequestError(`MoMo refund failed: ${data.message}`);
      }
      return data;
    } catch (error) {
      throw new BadRequestError(`MoMo refund error: ${error.message}`);
    }
  }

  async refundVNPayPayment({ orderId, amount, transId }) {
    // Placeholder: VNPay không hỗ trợ API hoàn tiền trực tiếp
    throw new BadRequestError(
      'VNPay refund not supported in this implementation'
    );
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
      throw new BadRequestError('Order has not been paid');
    }
    return order;
  }

  async _markOrderAsPaid(orderId, transId) {
    const order = await this._validateOrder(orderId);
    const updatedOrder = await this.orderRepository.updateById(order.id, {
      isPaid: true,
      paidAt: new Date(),
      status: OrderStatus.PAID,
      transactionId: transId,
    });

    if (!updatedOrder) {
      throw new InternalServerError('Failed to mark order as paid');
    }
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
