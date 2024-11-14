const BaseRepository = require('./base.repository');
const variantModels = require('../models/variant.model');

class VariantRepository extends BaseRepository {
  constructor() {
    super(variantModels);
    this.model = variantModels;
  }

  formatDocument(variant) {
    if (!variant) return null;

    const formattedVariant = {
      id: variant._id,
      productId: variant.product_id,
      tierIndex: variant.variant_tier_idx,
      isDefault: variant.variant_default,
      slug: variant.variant_slug,
      name: variant.variant_name,
      price: variant.variant_price,
      quantity: variant.variant_quantity,
      sold: variant.variant_sold,
      status: variant.variant_status,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    };

    return formattedVariant;
  }
}

module.exports = VariantRepository;
