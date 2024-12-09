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

router.get('/public', asyncHandler(productController.getAllProductsByUser));
router.get(
  '/public/:productId',
  asyncHandler(productController.getProductDetailsByUser)
);
router.patch(
  '/update-views',
  asyncHandler(productController.updateProductViews)
);

// Define the routes
router.post(
  '/',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.PRODUCT.CREATE),
  asyncHandler(productController.createProduct)
);
router.patch(
  '/',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.PRODUCT.UPDATE),
  asyncHandler(productController.updateProduct)
);
router.get(
  '/',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.PRODUCT.VIEW),
  asyncHandler(productController.getAllProducts)
);
router.get(
  '/:productId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.PRODUCT.VIEW),
  asyncHandler(productController.getProductDetails)
);

router.patch(
  '/publish/:productId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.PRODUCT.UPDATE),
  asyncHandler(productController.publishProduct)
);

router.patch(
  '/unpublish/:productId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.PRODUCT.UPDATE),
  asyncHandler(productController.unpublishProduct)
);
router.patch(
  '/update-quantity',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.PRODUCT.UPDATE),
  asyncHandler(productController.updateProductQuantity)
);

router.delete(
  '/:productId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_PRODUCT.PRODUCT.DELETE),
  asyncHandler(productController.deleteProduct)
);

module.exports = router;
