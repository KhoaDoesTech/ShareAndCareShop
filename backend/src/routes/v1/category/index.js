const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');
const CategoryController = require('../../../controllers/category.controller');
const express = require('express');
const asyncHandler = require('../../../middlewares/async.middleware');

// Initialize the router
const router = express.Router();

// Define the routes
router.post(
  '/',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.CATEGORY.CREATE),
  asyncHandler(CategoryController.createCategory)
);
router.delete(
  '/',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.CATEGORY.DELETE),
  asyncHandler(CategoryController.deleteCategory)
);
router.patch(
  '/',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.CATEGORY.UPDATE),
  asyncHandler(CategoryController.updateCategory)
);
router.get('/', asyncHandler(CategoryController.getCategoriesByParentId));
router.get('/all', asyncHandler(CategoryController.getAllCategories));

module.exports = router;
