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

  getAllProductsByUser = async (req, res, next) => {
    new ActionSuccess({
      message: 'Products retrieved successfully',
      metadata: await this.productService.getAllProductsPublic(req.query),
    }).send(res);
  };
}

module.exports = ProductController;
