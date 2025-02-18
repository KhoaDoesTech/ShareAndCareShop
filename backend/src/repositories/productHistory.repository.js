'use strict';

const BaseRepository = require('./base.repository');
const ProductHistoryModel = require('../models/productHistory.model');

class ProductHistoryRepository extends BaseRepository {
  constructor() {
    super(ProductHistoryModel);
    this.model = ProductHistoryModel;
  }

  async getLatestProductByProductId(productId) {
    const latestProduct = await this.model.findOne({ productId }).sort({
      createdAt: -1,
    });

    return this.formatDocument(latestProduct);
  }

  formatDocument(history) {
    if (!history) return null;

    return {
      id: history._id,
      productId: history.prd_id,
      code: history.prd_code,
      version: history.prd_version,
      action: history.prd_action,
      changedBy: history.prd_changed_by,
      name: history.prd_name,
      slug: history.prd_slug,
      description: history.prd_description,
      video: history.prd_video,
      mainImage: history.prd_main_image,
      subImages: history.prd_sub_images,
      qrCode: history.prd_qr_code,
      category: history.prd_category,
      attributes: history.prd_attributes,
      variants: history.prd_variants,
      returnDays: history.return_days,
      createdAt: history.createdAt,
      updatedAt: history.updatedAt,
    };
  }
}

module.exports = ProductHistoryRepository;
