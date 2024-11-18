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

router.delete(
  '/products',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.UPLOAD.DELETE),
  asyncHandler(UploadController.deleteImageByUrl)
);

module.exports = router;
