'use strict';

const express = require('express');
const validate = require('../../../middlewares/validate.middleware');
const asyncHandler = require('../../../middlewares/async.middleware');
const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');
const VariantController = require('../../../controllers/variant.controller');
const router = express.Router();

router.get(
  '/:productId',
  asyncHandler(VariantController.getVariantByProductId)
);
router.get(
  '/public/:productId',
  asyncHandler(VariantController.getPublicVariantByProductId)
);
router.patch(
  '/public/:variantId',
  asyncHandler(VariantController.publicVariant)
);
router.patch(
  '/unpublic/:variantId',
  asyncHandler(VariantController.unPublicVariant)
);
router.patch(
  '/product/public/:productId',
  asyncHandler(VariantController.publicAllVariants)
);
router.patch(
  '/product/unpublic/:productId',
  asyncHandler(VariantController.unPublicAllVariants)
);

module.exports = router;
