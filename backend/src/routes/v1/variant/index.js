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

router.post(
  '/',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.SKU.CREATE),
  asyncHandler(VariantController.createVariants)
);

router.get(
  '/public/:productId',
  asyncHandler(VariantController.getPublicVariantByProductId)
);

router.get(
  '/:productId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.SKU.VIEW),
  asyncHandler(VariantController.getVariantByProductId)
);
router.patch(
  '/public/:variantId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.SKU.UPDATE),
  asyncHandler(VariantController.publicVariant)
);
router.patch(
  '/unpublic/:variantId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.SKU.UPDATE),
  asyncHandler(VariantController.unPublicVariant)
);
router.patch(
  '/product/public/:productId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.SKU.UPDATE),
  asyncHandler(VariantController.publicAllVariants)
);
router.patch(
  '/product/unpublic/:productId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.SKU.UPDATE),
  asyncHandler(VariantController.unPublicAllVariants)
);

module.exports = router;
