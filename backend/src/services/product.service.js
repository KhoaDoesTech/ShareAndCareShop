const ProductRepository = require('../repositories/product.repository');
const { BadRequestError } = require('../utils/errorResponse');
const { omitFields } = require('../utils/helpers');
const VariantService = require('./variant.service');

class ProductService {
  constructor() {
    this.productRepository = new ProductRepository();
    this.variantService = new VariantService();
  }

  async createProduct({
    name,
    mainImage,
    subImages,
    price,
    quantity,
    description,
    category,
    attributes,
    variants,
    skuList,
  }) {
    const totalQuantity = skuList
      ? skuList.reduce((total, sku) => total + sku.quantity, 0)
      : quantity;

    const variantImages = variants.flatMap((variant) => variant.images);
    const updatedSubImages = Array.from(
      new Set([...subImages, ...variantImages])
    );

    const newProduct = await this.productRepository.create({
      product_name: name,
      product_main_image: mainImage,
      product_sub_images: updatedSubImages,
      product_price: price,
      product_quantity: totalQuantity,
      product_description: description,
      product_category: category,
      product_attributes: attributes,
      product_variants: variants.map((variant) => ({
        variant_name: variant.name,
        variant_images: variant.images,
        variant_options: variant.options,
      })),
    });

    if (!newProduct) throw new BadRequestError('Failed to create product');

    await this.variantService.createVariant({
      product: newProduct,
      variants,
      skuList,
    });

    return omitFields({
      fields: ['rating', 'views', 'uniqueViews', 'createdAt', 'updatedAt'],
      object: newProduct,
    });
  }
}

module.exports = ProductService;
