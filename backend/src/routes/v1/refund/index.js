'use strict';

const express = require('express');
const asyncHandler = require('../../../middlewares/async.middleware');
const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');
const refundController = require('../../../controllers/refund.controller');

const router = express.Router();

// User routes
router.post(
  '/:orderId/request',
  authentication,
  asyncHandler(refundController.createRefundRequest)
);
router.get(
  '/:refundLogId',
  authentication,
  asyncHandler(refundController.getRefundDetails)
);
router.get(
  '/user',
  authentication,
  asyncHandler(refundController.getRefundLogByUser)
);

// Admin routes
router.get(
  '/',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.REFUND.VIEW),
  asyncHandler(refundController.getRefundRequestsForAdmin)
);
router.patch(
  '/confirm',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.REFUND.APPROVE),
  asyncHandler(refundController.confirmReturnReceived)
);
router.patch(
  '/:refundLogId/approve',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.REFUND.APPROVE),
  asyncHandler(refundController.approveRefundRequest)
);
router.patch(
  '/:refundLogId/reject',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.REFUND.APPROVE),
  asyncHandler(refundController.rejectRefundRequest)
);

module.exports = router;
