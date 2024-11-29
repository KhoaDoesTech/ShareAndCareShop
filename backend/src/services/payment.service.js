const { sortObject } = require('../utils/helpers');
const moment = require('moment');
const { generateHmacHash } = require('../helpers/crypto.helper');
const OrderRepository = require('../repositories/order.repository');
const querystring = require('qs');
const { BadRequestError } = require('../utils/errorResponse');
class PaymentService {
  constructor() {
    this.orderRepository = new OrderRepository();

    this.vnpTmnCode = process.env.VNPAY_TMN_CODE;
    this.vnpHashSecret = process.env.VNPAY_SECRET;
    this.vnpUrl = process.env.VNPAY_URL;
  }

  async createVNPayUrl({
    ipAddress,
    orderId,
    totalPrice,
    language = 'vn',
    bankCode = 'VNBANK',
  }) {
    const date = new Date();
    const createDate = moment(date).format('YYYYMMDDHHmmss');
    const codeOrder = moment(date).format('DDHHmmss');

    const locale = ['vn', 'en'].includes(language) ? language : 'vn';
    const currCode = 'VND';

    const returnUrl = `${process.env.BACKEND_URL}/api/v1/payment/vnpay/callback`;

    let vnp_Params = {};
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = this.vnpTmnCode;
    vnp_Params['vnp_Locale'] = locale;
    vnp_Params['vnp_CurrCode'] = currCode;
    vnp_Params['vnp_TxnRef'] = orderId;
    vnp_Params['vnp_OrderInfo'] = 'Thanh toan cho ma GD:' + codeOrder;
    vnp_Params['vnp_OrderType'] = '200000';
    vnp_Params['vnp_Amount'] = totalPrice * 100;
    vnp_Params['vnp_ReturnUrl'] = returnUrl;
    vnp_Params['vnp_IpAddr'] = ipAddress;
    vnp_Params['vnp_CreateDate'] = createDate;
    if (bankCode) {
      vnp_Params['vnp_BankCode'] = bankCode;
    }

    vnp_Params = sortObject(vnp_Params);

    const signData = querystring.stringify(vnp_Params, { encode: false });

    const secureHash = generateHmacHash(signData, this.vnpHashSecret);
    vnp_Params['vnp_SecureHash'] = secureHash;

    const paymentUrl =
      this.vnpUrl + '?' + querystring.stringify(vnp_Params, { encode: false });

    return paymentUrl;
  }

  async checkPaymentStatus(vnp_Params) {
    const secureHash = vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    const sortedParams = sortObject(vnp_Params);
    const signData = querystring.stringify(sortedParams, { encode: false });
    const signedHash = generateHmacHash(signData, this.vnpHashSecret);

    if (secureHash !== signedHash)
      throw new BadRequestError('Invalid secure hash');

    const {
      vnp_Amount: amount,
      vnp_TxnRef: orderId,
      vnp_PayDate: payDate,
      vnp_BankCode: bankCode,
      vnp_BankTranNo: bankTranNo,
      vnp_CardType: cardType,
      vnp_TransactionNo: transactionNo,
    } = vnp_Params;

    const isSuccess = vnp_Params['vnp_TransactionStatus'] === '00';

    return {
      isSuccess,
      amount,
      orderId,
      payDate,
      bankCode,
      bankTranNo,
      cardType,
      transactionNo,
    };
  }
}

module.exports = PaymentService;
