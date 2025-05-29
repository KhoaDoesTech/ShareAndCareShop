'use strict';

const express = require('express');
const PaymentController = require('../../../controllers/payment.controller');
const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');
const asyncHandler = require('../../../middlewares/async.middleware');

const router = express.Router();

router.post(
  '/vnpay/create_payment_url',
  asyncHandler(PaymentController.createVNPayPaymentUrl)
);
router.get(
  '/vnpay/callback',
  asyncHandler(PaymentController.handleVNPayCallback)
);
router.post(
  '/momo/create_payment_url',
  asyncHandler(PaymentController.createMoMoPaymentUrl)
);
router.get(
  '/momo/callback',
  asyncHandler(PaymentController.handleMoMoCallback)
);

module.exports = router;
