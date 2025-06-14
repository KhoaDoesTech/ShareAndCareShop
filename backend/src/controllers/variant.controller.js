const VariantService = require('../services/variant.service');
const { CreateSuccess, ActionSuccess } = require('../utils/successResponse');

class VariantController {
  constructor() {
    this.variantService = new VariantService();
  }

  createVariants = async (req, res, next) => {
    new CreateSuccess({
      message: 'Tạo biến thể thành công',
      metadata: await this.variantService.createVariants(req.body),
    }).send(res);
  };

  publicAllVariants = async (req, res, next) => {
    new ActionSuccess({
      message: 'Đăng bán tất cả biến thể thành công',
      metadata: await this.variantService.publicAllVariants(
        req.params.productId
      ),
    }).send(res);
  };

  updateVariants = async (req, res, next) => {
    new ActionSuccess({
      message: 'Cập nhật biến thể thành công',
      metadata: await this.variantService.updateVariants(req.body),
    }).send(res);
  };

  getPublicVariantByProductId = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy biến thể công khai thành công',
      metadata: await this.variantService.getPublicVariantByProductId(
        req.params.productId
      ),
    }).send(res);
  };

  getVariantByProductId = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy biến thể thành công',
      metadata: await this.variantService.getVariantByProductId(
        req.params.productId
      ),
    }).send(res);
  };

  publicVariant = async (req, res, next) => {
    new ActionSuccess({
      message: 'Đăng bán biến thể thành công',
      metadata: await this.variantService.publicVariant(req.params.variantId),
    }).send(res);
  };

  unPublicVariant = async (req, res, next) => {
    new ActionSuccess({
      message: 'Ngừng đăng bán biến thể thành công',
      metadata: await this.variantService.unPublicVariant(req.params.variantId),
    }).send(res);
  };

  unPublicAllVariants = async (req, res, next) => {
    new ActionSuccess({
      message: 'Ngừng đăng bán tất cả biến thể thành công',
      metadata: await this.variantService.unPublicAllVariants(
        req.params.productId
      ),
    }).send(res);
  };
}

module.exports = new VariantController();
