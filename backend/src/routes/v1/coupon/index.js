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

router.get(
  '/user/:couponKey',
  asyncHandler(CouponController.getCouponDetailsByUser)
);

router.post(
  '/',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.COUPON.CREATE),
  asyncHandler(CouponController.createCoupon)
);

router.get(
  '/review',
  authentication,
  asyncHandler(CouponController.reviewDiscount)
);

router.get(
  '/all',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.COUPON.VIEW),
  asyncHandler(CouponController.getAllCoupons)
);

router.get(
  '/:couponKey',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.COUPON.VIEW),
  asyncHandler(CouponController.getCouponDetailsByAdmin)
);

module.exports = router;
