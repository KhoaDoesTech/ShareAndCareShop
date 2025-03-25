'use strict';

const BaseRepository = require('./base.repository');
const productModels = require('../models/product.model');
const mongoose = require('mongoose');
const { ProductStatus } = require('../constants/status');

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
      query = { $or: [{ prd_code: identifier }, { prd_slug: identifier }] };
    }

    return this.formatDocument(await this.model.findOne(query));
  }

  async getProductsInfo(identifier, productFilter = {}) {
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      productFilter._id = identifier;
    } else {
      productFilter.$or = [{ prd_code: identifier }, { prd_slug: identifier }];
    }

    const populateOptions = [
      { path: 'prd_attributes.id', model: 'Attribute' },
      { path: 'prd_attributes.values.id', model: 'AttributeValue' },
    ];

    return await this.getByQuery(productFilter, populateOptions);
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
      attributes: product.prd_attributes?.map((attr) => ({
        id: attr.id?._id,
        name: attr.id?.attr_name,
        type: attr.id?.attr_type,
        isVariant: attr.id?.attr_is_variant,
        values: attr.values?.map((val) => ({
          id: val.id?._id,
          value: val.id?.value,
          descriptionUrl: val.id?.description_url,
        })),
      })),
      status: product.prd_status,
      rating: product.prd_rating,
      ratingCount: product.prd_rating_count,
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
