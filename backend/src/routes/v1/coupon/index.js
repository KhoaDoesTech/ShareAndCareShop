'use strict';

const express = require('express');
const CouponController = require('../../../controllers/coupon.controller');
const asyncHandler = require('../../../middlewares/async.middleware');
const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');

const router = express.Router();

router.post(
  '/',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.COUPON.CREATE),
  asyncHandler(CouponController.createCoupon)
);

module.exports = router;
