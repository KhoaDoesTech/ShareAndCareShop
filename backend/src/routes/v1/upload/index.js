'use strict';

const express = require('express');
const upload = require('../../../middlewares/multer.middleware');
const UploadController = require('../../../controllers/upload.controller');
const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');
const asyncHandler = require('../../../middlewares/async.middleware');

const router = express.Router();

router.post(
  '/products',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.UPLOAD.CREATE),
  upload.single('products'),
  asyncHandler(UploadController.uploadProductImage)
);

router.post(
  '/banners',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.UPLOAD.CREATE),
  upload.single('banners'),
  asyncHandler(UploadController.uploadBannerImage)
);

router.post(
  '/chat',
  upload.single('chat'),
  asyncHandler(UploadController.uploadChatImage)
);

router.post(
  '/reviews',
  authentication,
  upload.single('review'),
  asyncHandler(UploadController.uploadReviewImage)
);

router.post(
  '/transfers',
  authentication,
  upload.single('transfer'),
  asyncHandler(UploadController.uploadTransferImage)
);

router.delete(
  '/',
  authentication,
  asyncHandler(UploadController.deleteImageByUrl)
);

module.exports = router;
