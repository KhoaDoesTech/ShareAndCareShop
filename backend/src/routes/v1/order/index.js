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

router.get('/review-order', asyncHandler(OrderController.reviewOrder));
router.patch(
  '/cancel/:orderId',
  authentication,
  asyncHandler(OrderController.cancelOrder)
);
router.get(
  '/',
  authentication,
  asyncHandler(OrderController.getOrdersByUserId)
);
router.get(
  '/:orderId',
  authentication,
  asyncHandler(OrderController.getOrderDetailsByUser)
);
router.post('/', authentication, asyncHandler(OrderController.createOrder));

router.get(
  '/all/:orderId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.ORDER.VIEW),
  asyncHandler(OrderController.getOrderDetails)
);
router.get(
  '/all',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.ORDER.VIEW),
  asyncHandler(OrderController.getAllOrders)
);
router.patch(
  '/next-status/:orderId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.ORDER.UPDATE),
  asyncHandler(OrderController.updateOrderStatus)
);
router.get(
  '/next-status/:orderId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.ORDER.UPDATE),
  asyncHandler(OrderController.reviewNextStatus)
);

module.exports = router;
