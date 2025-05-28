'use strict';

const express = require('express');
const OrderController = require('../../../controllers/order.controller');
const asyncHandler = require('../../../middlewares/async.middleware');
const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');

const router = express.Router();

// User and Admin routes
router.get(
  '/review',
  authentication,
  asyncHandler(OrderController.reviewOrder)
);
router.post('/', authentication, asyncHandler(OrderController.createOrder));

// User routes
router.get(
  '/user',
  authentication,
  asyncHandler(OrderController.getOrdersListForUser)
);
router.get(
  '/user/:orderId',
  authentication,
  asyncHandler(OrderController.getOrderDetailsForUser)
);
router.patch(
  '/user/:orderId/cancel',
  authentication,
  asyncHandler(OrderController.cancelOrder)
);
router.post(
  '/user/:orderId/returns',
  authentication,
  asyncHandler(OrderController.requestReturn)
);

// Admin routes
router.get(
  '/',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.ORDER.VIEW),
  asyncHandler(OrderController.getOrdersListForAdmin)
);
router.get(
  '/:orderId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.ORDER.VIEW),
  asyncHandler(OrderController.getOrderDetailsForAdmin)
);
router.patch(
  '/:orderId/status',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.ORDER.UPDATE),
  asyncHandler(OrderController.updateOrderStatus)
);
router.patch(
  '/:orderId/returns/approval',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.ORDER.RETURN_APPROVE),
  asyncHandler(OrderController.approveReturn)
);

module.exports = router;
