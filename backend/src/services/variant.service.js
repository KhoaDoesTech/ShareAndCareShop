const { ProductStatus } = require('../constants/status');
const ProductRepository = require('../repositories/product.repository');
const VariantRepository = require('../repositories/variant.repository');
const { BadRequestError } = require('../utils/errorResponse');
const {
  generateVariantSlug,
  pickFields,
  omitFields,
} = require('../utils/helpers');

class VariantService {
  constructor() {
    this.variantRepository = new VariantRepository();
    this.productRepository = new ProductRepository();
  }

  async createVariants({ productKey, skuList }) {
    const foundProduct = await this.productRepository.getProduct(productKey);
    if (!foundProduct) {
      throw new BadRequestError(`Product with ID: ${productKey} not found`);
    }

    const convertSkuList = skuList.map((sku, index) => ({
      prd_id: foundProduct.id,
      prd_name: foundProduct.name,
      var_tier_idx: sku.tierIndex,
      var_default: sku.isDefault,
      var_slug: sku.slug,
      var_price: sku.price,
    }));

    const variant = await this.variantRepository.create(convertSkuList);
    if (!variant) throw new BadRequestError('Failed to create variant');

    return foundProduct.code;
  }

  async updateOrCreateVariants(product, variants, skuList) {
    const convertSkuList = skuList.map((sku) => ({
      prd_id: product.id,
      prd_name: product.name,
      var_tier_idx: sku.tierIndex,
      var_default: sku.isDefault,
      var_slug: generateVariantSlug(variants, sku.tierIndex),
      var_price: sku.price,
      var_quantity: sku.quantity,
      var_sold: sku.sold,
    }));

    await this.variantRepository.deleteByProductId(product.id);

    await this.variantRepository.create(convertSkuList);
  }

  async deleteVariants(productId) {
    const deletedVariants = await this.variantRepository.deleteByProductId(
      productId
    );

    return deletedVariants;
  }

  async updateVariants({ product, variants, skuList }) {
    const formattedVariants = this._formatVariants(variants);

    this._validateSkuList(formattedVariants, skuList);

    await this.updateOrCreateVariants(product, formattedVariants, skuList);
  }

  _formatVariants(variants) {
    return variants.map((variant) => ({
      name: variant.name,
      images: variant.images || [],
      options: variant.options || [],
    }));
  }

  _validateSkuList(variants, skuList) {
    const numOfTiers = variants.length;
    skuList.forEach((sku) => {
      if (sku.tierIndex.length !== numOfTiers) {
        throw new BadRequestError(
          `Invalid tierIndex length for SKU: ${JSON.stringify(sku)}`
        );
      }
      sku.tierIndex.forEach((tier, idx) => {
        if (tier < 0 || tier >= variants[idx].options.length) {
          throw new BadRequestError(
            `Invalid tierIndex value: ${tier} for variant "${variants[idx].name}"`
          );
        }
      });
    });
  }

  async getPublicVariantByProductId(productId) {
    const variants = await this.variantRepository.getVariantByFilter({
      prd_id: productId,
      var_status: ProductStatus.PUBLISHED,
    });

    return {
      skuList: variants.map((sku) =>
        omitFields({
          fields: [
            'createdAt',
            'updatedAt',
            'status',
            'sold',
            'name',
            'productId',
          ],
          object: sku,
        })
      ),
    };
  }

  async getVariantByProductId(productId) {
    const variants = await this.variantRepository.getVariantByFilter({
      prd_id: productId,
    });

    return {
      skuList: variants.map((sku) =>
        omitFields({
          fields: ['createdAt', 'updatedAt', 'name', 'productId'],
          object: sku,
        })
      ),
    };
  }

  async publicAllVariants(productId) {
    const variants = await this.variantRepository.updateMany(
      { prd_id: productId },
      { var_status: ProductStatus.PUBLISHED }
    );

    return variants;
  }

  async unPublicAllVariants(productId) {
    const variants = await this.variantRepository.updateMany(
      { prd_id: productId },
      { var_status: ProductStatus.DISCONTINUED }
    );

    return variants;
  }

  async publicVariant(variantId) {
    const variant = await this.variantRepository.updateById(variantId, {
      var_status: ProductStatus.PUBLISHED,
    });

    return {
      variant: pickFields({
        fields: ['id', 'name', 'slug', 'status'],
        object: variant,
      }),
    };
  }

  async unPublicVariant(variantId) {
    const variant = await this.variantRepository.updateById(variantId, {
      var_status: ProductStatus.DISCONTINUED,
    });

    return {
      variant: pickFields({
        fields: ['id', 'name', 'slug', 'status'],
        object: variant,
      }),
    };
  }

  async updateVariantQuantities(skuList) {
    for (const sku of skuList) {
      const { id: skuId, quantity } = sku;

      const foundVariant = await this.variantRepository.getById(skuId);
      if (!foundVariant) {
        throw new BadRequestError(`Variant with ID: ${skuId} not found`);
      }

      const totalVariantQuantity = quantity + foundVariant.quantity;
      const status =
        totalVariantQuantity === 0
          ? ProductStatus.OUT_OF_STOCK
          : ProductStatus.PUBLISHED;

      const updatedVariant = await this.variantRepository.updateById(skuId, {
        var_quantity: totalVariantQuantity,
        var_status: status,
      });

      if (!updatedVariant) {
        throw new BadRequestError(`Failed to update variant with ID: ${skuId}`);
      }
    }
  }

  async _calculateTotalVariantQuantity(productId) {
    const variants = await this.variantRepository.getVariantByFilter({
      prd_id: productId,
    });

    return variants.reduce((total, variant) => total + variant.quantity, 0);
  }
}

module.exports = VariantService;
