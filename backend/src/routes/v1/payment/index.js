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

router.post(
  '/cod/:orderId/confirm',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.PAYMENT.CONFIRM),
  asyncHandler(PaymentController.confirmCODPayment)
);

router.post(
  '/cod/:orderId/manual',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.PAYMENT.CONFIRM),
  asyncHandler(PaymentController.processManualPayment)
);

router.post(
  '/manual/:paymentTransactionId/refund',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.PAYMENT.REFUND),
  asyncHandler(PaymentController.processManualRefund)
);

// --- Transaction Management for Admin ---
router.get(
  '/admin/transactions',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.PAYMENT.VIEW),
  asyncHandler(PaymentController.getTransactionsByAdmin)
);

router.get(
  '/admin/transactions/:transactionId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.PAYMENT.VIEW),
  asyncHandler(PaymentController.getTransactionDetail)
);

module.exports = router;
