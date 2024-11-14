const BaseRepository = require('./base.repository');
const productModels = require('../models/product.model');

class ProductRepository extends BaseRepository {
  constructor() {
    super(productModels);
    this.model = productModels;
  }

  formatDocument(product) {
    if (!product) return null;

    const formattedProduct = {
      id: product._id,
      name: product.product_name,
      slug: product.product_slug,
      mainImage: product.product_main_image,
      subImages: product.product_sub_images,
      price: product.product_price,
      quantity: product.product_quantity,
      sold: product.product_sold,
      description: product.product_description,
      category: product.product_category,
      attributes: product.product_attributes,
      status: product.product_status,
      variants: product.product_variants.map((variant) => ({
        name: variant.variant_name,
        images: variant.variant_images,
        options: variant.variant_options,
      })),
      rating: product.product_rating,
      views: product.product_views,
      uniqueViews: product.product_unique_views,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    return formattedProduct;
  }
}

module.exports = ProductRepository;
