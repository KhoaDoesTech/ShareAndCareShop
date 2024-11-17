class VariantController {
  constructor() {
    this.variantService = new VariantService();
  }

  async createVariant(req, res, next) {
    new CreateSuccess({
      message: 'Variant created successfully',
      metadata: await this.variantService.createVariant(req.body),
    }).send(res);
  }
}

module.exports = new VariantController();
