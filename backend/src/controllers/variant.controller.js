const VariantService = require('../services/variant.service');
const { CreateSuccess, ActionSuccess } = require('../utils/successResponse');

class VariantController {
  constructor() {
    this.variantService = new VariantService();
  }

  createVariants = async (req, res, next) => {
    new CreateSuccess({
      message: 'Variant created successfully',
      metadata: await this.variantService.createVariants(req.body),
    }).send(res);
  };

  publicAllVariants = async (req, res, next) => {
    new ActionSuccess({
      message: 'All variants published successfully',
      metadata: await this.variantService.publicAllVariants(
        req.params.productId
      ),
    }).send(res);
  };

  updateVariants = async (req, res, next) => {
    new ActionSuccess({
      message: 'Variant updated successfully',
      metadata: await this.variantService.updateVariants(req.body),
    }).send(res);
  };

  getPublicVariantByProductId = async (req, res, next) => {
    new ActionSuccess({
      message: 'Public variant retrieved successfully',
      metadata: await this.variantService.getPublicVariantByProductId(
        req.params.productId
      ),
    }).send(res);
  };

  getVariantByProductId = async (req, res, next) => {
    new ActionSuccess({
      message: 'Variant retrieved successfully',
      metadata: await this.variantService.getVariantByProductId(
        req.params.productId
      ),
    }).send(res);
  };

  publicVariant = async (req, res, next) => {
    new ActionSuccess({
      message: 'Variant published successfully',
      metadata: await this.variantService.publicVariant(req.params.variantId),
    }).send(res);
  };

  unPublicVariant = async (req, res, next) => {
    new ActionSuccess({
      message: 'Variant unpublished successfully',
      metadata: await this.variantService.unPublicVariant(req.params.variantId),
    }).send(res);
  };

  unPublicAllVariants = async (req, res, next) => {
    new ActionSuccess({
      message: 'All variants unpublished successfully',
      metadata: await this.variantService.unPublicAllVariants(
        req.params.productId
      ),
    }).send(res);
  };
}

module.exports = new VariantController();
