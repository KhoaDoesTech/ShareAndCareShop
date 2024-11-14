const VariantRepository = require('../repositories/variant.repository');
const { BadRequestError } = require('../utils/errorResponse');
const { generateVariantSlug } = require('../utils/helpers');

class VariantService {
  constructor() {
    this.variantRepository = new VariantRepository();
  }

  async createVariant({ product, variants, skuList }) {
    const convertSkuList = skuList.map((sku, index) => ({
      product_id: product.id,
      product_name: product.name,
      variant_tier_idx: sku.tierIndex,
      variant_default: sku.isDefault,
      variant_slug: generateVariantSlug(variants, sku.tierIndex),
      variant_name: sku.name,
      variant_price: sku.price,
      variant_quantity: sku.quantity,
    }));

    const variant = await this.variantRepository.create(convertSkuList);
    if (!variant) throw new BadRequestError('Failed to create variant');

    return variant;
  }
}

module.exports = VariantService;
