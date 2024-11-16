const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');
const ProductController = require('../../../controllers/product.controller');
const express = require('express');
const asyncHandler = require('../../../middlewares/async.middleware');

// Initialize the router
const router = express.Router();
const productController = new ProductController();

// Define the routes
router.post(
  '/',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.PRODUCT.CREATE),
  asyncHandler(productController.createProduct)
);

router.get('/', asyncHandler(productController.getAllProductsByUser));

module.exports = router;
