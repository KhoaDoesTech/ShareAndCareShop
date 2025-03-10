'use strict';

const express = require('express');
const AttributeController = require('../../../controllers/attribute.controller');
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
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.ATTRIBUTE.CREATE),
  asyncHandler(AttributeController.createAttribute)
);

router.post(
  '/values',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.ATTRIBUTE.UPDATE),
  asyncHandler(AttributeController.addValuesToAttribute)
);

router.get(
  '/all',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.ATTRIBUTE.VIEW),
  asyncHandler(AttributeController.getAllAttributes)
);

router.get('/', asyncHandler(AttributeController.getAttributesByUser));

module.exports = router;
