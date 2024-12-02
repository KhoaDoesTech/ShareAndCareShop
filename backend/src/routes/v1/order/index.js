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
router.post('/', authentication, asyncHandler(OrderController.createOrder));

module.exports = router;
