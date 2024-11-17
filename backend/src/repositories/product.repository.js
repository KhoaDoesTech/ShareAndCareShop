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
      name: product.prd_name,
      slug: product.prd_slug,
      mainImage: product.prd_main_image,
      subImages: product.prd_sub_images,
      price: product.prd_price,
      originalPrice: product.prd_original_price,
      quantity: product.prd_quantity,
      sold: product.prd_sold,
      description: product.prd_description,
      category: product.prd_category,
      attributes: product.prd_attributes,
      status: product.prd_status,
      rating: product.prd_rating,
      views: product.prd_views,
      uniqueViews: product.prd_unique_views,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      variants: (product.prd_variants || []).map((variant) => ({
        name: variant.var_name,
        images: variant.var_images,
        options: variant.var_options,
      })),
    };

    return formattedProduct;
  }
}

module.exports = ProductRepository;
