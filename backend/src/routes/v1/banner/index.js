'use strict';

const express = require('express');
const BannerController = require('../../../controllers/banner.controller');
const asyncHandler = require('../../../middlewares/async.middleware');
const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');

const router = express.Router();

// Public routes
router.get('/public', asyncHandler(BannerController.getActiveBanners));

// Admin routes
router.post(
  '/',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SYSTEM.BANNER.CREATE),
  asyncHandler(BannerController.createBanner)
);

router.put(
  '/:bannerId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SYSTEM.BANNER.UPDATE),
  asyncHandler(BannerController.updateBanner)
);

router.delete(
  '/:bannerId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SYSTEM.BANNER.DELETE),
  asyncHandler(BannerController.deleteBanner)
);

router.get(
  '/',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SYSTEM.BANNER.VIEW),
  asyncHandler(BannerController.getAllBanners)
);

router.get(
  '/:bannerId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SYSTEM.BANNER.VIEW),
  asyncHandler(BannerController.getBannerDetails)
);

router.patch(
  '/:bannerId/publish',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SYSTEM.BANNER.UPDATE),
  asyncHandler(BannerController.publishBanner)
);

router.patch(
  '/:bannerId/unpublish',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SYSTEM.BANNER.UPDATE),
  asyncHandler(BannerController.unpublishBanner)
);

router.patch(
  '/orders/update',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SYSTEM.BANNER.UPDATE),
  asyncHandler(BannerController.updateBannerOrders)
);

router.delete(
  '/expired/all',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SYSTEM.BANNER.DELETE),
  asyncHandler(BannerController.deleteExpiredBanners)
);

module.exports = router;
