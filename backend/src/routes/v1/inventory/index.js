'use strict';

const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');
const inventoryController = require('../../../controllers/inventory.controller');
const express = require('express');
const asyncHandler = require('../../../middlewares/async.middleware');

// Initialize the router
const router = express.Router();

router.get(
  '/',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.PRODUCT.VIEW),
  asyncHandler(inventoryController.getAllInventory)
);

router.get(
  '/:inventoryKey',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.PRODUCT.VIEW),
  asyncHandler(inventoryController.getInventoryById)
);

router.post(
  '/import-stock',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.PRODUCT.UPDATE),
  asyncHandler(inventoryController.importStock)
);

module.exports = router;
