const ProductService = require('../services/product.service');
const {
  ActionSuccess,
  CreateSuccess,
  NoContentSuccess,
} = require('../utils/successResponse');

class ProductController {
  constructor() {
    this.productService = new ProductService();
  }

  createProduct = async (req, res, next) => {
    new CreateSuccess({
      message: 'Product created successfully',
      metadata: await this.productService.createProduct({
        userId: req.user.id,
        ...req.body,
      }),
    }).send(res);
  };

  updateProduct = async (req, res, next) => {
    new ActionSuccess({
      message: 'Product updated successfully',
      metadata: await this.productService.updateProduct({
        userId: req.user.id,
        ...req.body,
      }),
    }).send(res);
  };

  getAllProductsByUser = async (req, res, next) => {
    new ActionSuccess({
      message: 'Products retrieved successfully',
      metadata: await this.productService.getAllProductsPublic(req.query),
    }).send(res);
  };

  getAllProducts = async (req, res, next) => {
    new ActionSuccess({
      message: 'Products retrieved successfully',
      metadata: await this.productService.getAllProducts(req.query),
    }).send(res);
  };

  getProductDetailsByUser = async (req, res, next) => {
    new ActionSuccess({
      message: 'Product details retrieved successfully',
      metadata: await this.productService.getProductDetailsPublic(req.params),
    }).send(res);
  };

  getProductDetails = async (req, res, next) => {
    new ActionSuccess({
      message: 'Product details retrieved successfully',
      metadata: await this.productService.getProductDetails(req.params),
    }).send(res);
  };

  publishProduct = async (req, res, next) => {
    new ActionSuccess({
      message: 'Product published successfully',
      metadata: await this.productService.publishProduct(req.params),
    }).send(res);
  };

  unpublishProduct = async (req, res, next) => {
    new ActionSuccess({
      message: 'Product unpublished successfully',
      metadata: await this.productService.unpublishProduct(req.params),
    }).send(res);
  };

  updateProductViews = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Product views updated successfully',
      metadata: await this.productService.updateProductUniqueViews(req.body),
    }).send(res);
  };

  updateProductQuantity = async (req, res, next) => {
    new ActionSuccess({
      message: 'Product quantity updated successfully',
      metadata: await this.productService.updateProductQuantity(req.body),
    }).send(res);
  };

  deleteProduct = async (req, res, next) => {
    new ActionSuccess({
      message: 'Product deleted successfully',
      metadata: await this.productService.deleteProduct(req.params),
    }).send(res);
  };
}

module.exports = ProductController;
