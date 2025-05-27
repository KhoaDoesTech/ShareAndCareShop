const VNPAY_CONFIG = {
  VERSION: '2.1.0',
  COMMAND: 'pay',
  CURR_CODE: 'VND',
  ORDER_TYPE: '200000',
  LOCALE_DEFAULT: 'vn',
};

const MOMO_CONFIG = {
  REQUEST_TYPE: 'payWithMethod',
  ORDER_INFO: 'pay with MoMo',
  LANG: 'vi',
  AUTO_CAPTURE: true,
};

module.exports = {
  VNPAY_CONFIG,
  MOMO_CONFIG,
};
