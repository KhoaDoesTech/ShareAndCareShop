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
  asyncHandler(PaymentController.createVNPayUrl)
);
router.get(
  '/vnpay/callback',
  asyncHandler(PaymentController.checkPaymentStatus)
);

module.exports = router;
