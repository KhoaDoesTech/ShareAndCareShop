'use strict';

const VNPAY_CONFIG = {
  VERSION: '2.1.0',
  COMMAND: 'pay',
  CURR_CODE: 'VND',
  ORDER_TYPE: '200000',
  LOCALE_DEFAULT: 'vn',
  TMN_CODE: process.env.VNPAY_TMN_CODE,
  SECRET: process.env.VNPAY_SECRET,
  URL: process.env.VNPAY_URL,
};

const MOMO_CONFIG = {
  REQUEST_TYPE: 'payWithMethod',
  ORDER_INFO: 'pay with MoMo',
  LANG: 'vi',
  AUTO_CAPTURE: true,
  PARTNER_CODE: process.env.MOMO_PARTNER_CODE,
  ACCESS_KEY: process.env.MOMO_ACCESS_KEY,
  SECRET_KEY: process.env.MOMO_SECRET_KEY,
  API_URL: process.env.MOMO_API_URL,
  REFUND_URL: process.env.MOMO_REFUND_URL,
  IPN_URL: process.env.MOMO_IPN_URL,
};

module.exports = {
  VNPAY_CONFIG,
  MOMO_CONFIG,
};
