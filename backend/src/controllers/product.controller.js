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
      message: 'Tạo sản phẩm thành công',
      metadata: await this.productService.createProduct({
        userId: req.user.id,
        ...req.body,
      }),
    }).send(res);
  };

  updateProduct = async (req, res, next) => {
    new ActionSuccess({
      message: 'Cập nhật sản phẩm thành công',
      metadata: await this.productService.updateProduct({
        userId: req.user.id,
        ...req.body,
      }),
    }).send(res);
  };

  getAllProductsByUser = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy danh sách sản phẩm thành công',
      metadata: await this.productService.getAllProductsPublic(req.query),
    }).send(res);
  };

  getAllProducts = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy danh sách sản phẩm thành công',
      metadata: await this.productService.getAllProducts(req.query),
    }).send(res);
  };

  getProductDetailsByUser = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy chi tiết sản phẩm thành công',
      metadata: await this.productService.getProductDetailsPublic(req.params),
    }).send(res);
  };

  getProductDetails = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy chi tiết sản phẩm thành công',
      metadata: await this.productService.getProductDetails(req.params),
    }).send(res);
  };

  publishProduct = async (req, res, next) => {
    new ActionSuccess({
      message: 'Đăng bán sản phẩm thành công',
      metadata: await this.productService.publishProduct(req.params),
    }).send(res);
  };

  unpublishProduct = async (req, res, next) => {
    new ActionSuccess({
      message: 'Ngừng đăng bán sản phẩm thành công',
      metadata: await this.productService.unpublishProduct(req.params),
    }).send(res);
  };

  updateProductViews = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Cập nhật lượt xem sản phẩm thành công',
      metadata: await this.productService.updateProductUniqueViews(req.body),
    }).send(res);
  };

  updateProductQuantity = async (req, res, next) => {
    new ActionSuccess({
      message: 'Cập nhật số lượng sản phẩm thành công',
      metadata: await this.productService.updateProductQuantity(req.body),
    }).send(res);
  };

  deleteProduct = async (req, res, next) => {
    new ActionSuccess({
      message: 'Xóa sản phẩm thành công',
      metadata: await this.productService.deleteProduct(req.params),
    }).send(res);
  };
}

module.exports = ProductController;
