const { ProductStatus } = require('../constants/status');
const VariantRepository = require('../repositories/variant.repository');
const { BadRequestError } = require('../utils/errorResponse');
const { generateVariantSlug } = require('../utils/helpers');

class VariantService {
  constructor() {
    this.variantRepository = new VariantRepository();
  }

  async createVariants({ product, variants, skuList }) {
    const convertSkuList = skuList.map((sku, index) => ({
      prd_id: product.id,
      prd_name: product.name,
      var_tier_idx: sku.tierIndex,
      var_default: sku.isDefault,
      var_slug: generateVariantSlug(variants, sku.tierIndex),
      var_price: sku.price,
      var_quantity: sku.quantity,
    }));

    const variant = await this.variantRepository.create(convertSkuList);
    if (!variant) throw new BadRequestError('Failed to create variant');

    return variant;
  }

  async updateVariants({ product, variants, skuList }) {
    await this.variantRepository.deleteByProductId(product.id);

    const updatedVariants = await this.createVariants({
      product,
      variants,
      skuList,
    });

    return updatedVariants;
  }

  async getPublicVariantByProductId(productId) {
    const variant = await this.variantRepository.getVariantByFilter({
      prd_id: productId,
      var_status: ProductStatus.PUBLISHED,
    });

    return variant;
  }

  async getVariantByProductId(productId) {
    const variant = await this.variantRepository.getVariantByFilter({
      prd_id: productId,
    });

    return variant;
  }
}

module.exports = VariantService;
