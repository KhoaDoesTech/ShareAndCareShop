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
      throw new BadRequestError(
        `Không tìm thấy sản phẩm với ID: ${productKey}`
      );
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
    if (!variant) throw new BadRequestError('Tạo biến thể thất bại');

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
          `Độ dài tierIndex không hợp lệ cho SKU: ${JSON.stringify(sku)}`
        );
      }
      sku.tierIndex.forEach((tier, idx) => {
        if (tier < 0 || tier >= variants[idx].options.length) {
          throw new BadRequestError(
            `Giá trị tierIndex không hợp lệ: ${tier} cho biến thể "${variants[idx].name}"`
          );
        }
      });
    });
  }

  async getPublicVariantByProductId(productId) {
    const variants = await this.variantRepository.getVariantsByProductId(
      productId
    );

    return {
      skuList: variants.map((sku) =>
        omitFields({
          fields: [
            'product',
            'createdAt',
            'updatedAt',
            'status',
            'sold',
            'name',
            'productId',
            'createdBy',
            'updatedBy',
            'createdDetail',
            'updatedDetail',
          ],
          object: sku,
        })
      ),
    };
  }

  async getVariantByProductId(productId) {
    const variants = await this.variantRepository.getVariantsByProductId(
      productId
    );

    return {
      skuList: variants.map((sku) =>
        omitFields({
          fields: [
            'createdAt',
            'updatedAt',
            'name',
            'productId',
            'product',
            'createdBy',
            'updatedBy',
            'createdDetail',
            'updatedDetail',
          ],
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
        throw new BadRequestError(`Không tìm thấy biến thể với ID: ${skuId}`);
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
        throw new BadRequestError(
          `Cập nhật biến thể với ID: ${skuId} thất bại`
        );
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
