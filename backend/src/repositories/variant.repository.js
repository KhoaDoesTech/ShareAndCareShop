const BaseRepository = require('./base.repository');
const variantModels = require('../models/variant.model');

class VariantRepository extends BaseRepository {
  constructor() {
    super(variantModels);
    this.model = variantModels;
  }

  async getVariantByFilter(filter) {
    const variants = await this.model.find(filter).lean();
    return variants.map(this.formatDocument.bind(this));
  }

  async deleteByProductId(productId) {
    return await this.model.deleteMany({ prd_id: productId });
  }

  async updateMany(filter, data) {
    const variants = await this.model.updateMany(filter, data);

    return variants;
  }

  formatDocument(variant) {
    if (!variant) return null;

    const formattedVariant = {
      id: variant._id,
      productId: variant.prd_id,
      name: variant.prd_name,
      slug: variant.var_slug,
      tierIndex: variant.var_tier_idx,
      isDefault: variant.var_default,
      price: variant.var_price,
      quantity: variant.var_quantity,
      sold: variant.var_sold,
      status: variant.var_status,
      createdBy: variant.createdBy,
      updatedBy: variant.updatedBy,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    };

    return formattedVariant;
  }
}

module.exports = VariantRepository;
