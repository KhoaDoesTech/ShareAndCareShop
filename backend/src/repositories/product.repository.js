'use strict';

const BaseRepository = require('./base.repository');
const productModels = require('../models/product.model');
const mongoose = require('mongoose');

class ProductRepository extends BaseRepository {
  constructor() {
    super(productModels);
    this.model = productModels;
  }

  async countDocuments(filter) {
    try {
      return await this.model.countDocuments(filter);
    } catch (error) {
      throw new Error(`Failed to count documents: ${error.message}`);
    }
  }

  async getProductByCategory(categoryIds) {
    return await this.model.find({ prd_category: { $in: categoryIds } });
  }

  async getProduct(identifier) {
    let query = {};

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      query = { _id: identifier };
    } else {
      query = { $or: [{ prd_id: identifier }, { prd_slug: identifier }] };
    }

    return this.formatDocument(await this.model.findOne(query));
  }

  formatDocument(product) {
    if (!product) return null;

    const formattedProduct = {
      id: product._id,
      code: product.prd_code,
      name: product.prd_name,
      slug: product.prd_slug,
      description: product.prd_description,
      video: product.prd_video,
      mainImage: product.prd_main_image,
      subImages: product.prd_sub_images,
      qrCode: product.prd_qr_code,
      price: product.prd_price,
      originalPrice: product.prd_original_price,
      minPrice: product.prd_min_price,
      maxPrice: product.prd_max_price,
      discountType: product.prd_discount_type,
      discountValue: product.prd_discount_value,
      discountStart: product.prd_discount_start,
      discountEnd: product.prd_discount_end,
      quantity: product.prd_quantity,
      sold: product.prd_sold,
      category: product.prd_category,
      attributes: product.prd_attributes,
      status: product.prd_status,
      rating: product.prd_rating,
      views: product.prd_views,
      uniqueViews: product.prd_unique_views,
      createdBy: product.createdBy,
      updatedBy: product.updatedBy,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      returnDays: product.return_days,
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
