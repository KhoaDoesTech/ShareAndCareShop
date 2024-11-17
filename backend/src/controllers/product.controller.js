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
      metadata: await this.productService.createProduct(req.body),
    }).send(res);
  };

  updateProduct = async (req, res, next) => {
    new ActionSuccess({
      message: 'Product updated successfully',
      metadata: await this.productService.updateProduct(req.body),
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
}

module.exports = ProductController;
