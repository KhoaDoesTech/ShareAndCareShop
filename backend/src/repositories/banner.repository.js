'use strict';

const BannerModel = require('../models/banner.model');
const BaseRepository = require('./base.repository');

class BannerRepository extends BaseRepository {
  constructor() {
    super(BannerModel);
    this.model = BannerModel;
  }

  async getActiveBanners() {
    const banners = await this.model
      .find({ bnn_is_active: true })
      .sort({ bnn_display_order: 1, createdAt: -1 })
      .lean();
    return banners.map(this.formatDocument);
  }

  async updateMany(filter, update) {
    return this.model.updateMany(filter, update);
  }

  formatDocument(banner) {
    if (!banner) return null;
    return {
      id: banner._id,
      title: banner.bnn_title,
      subtitle: banner.bnn_subtitle,
      ctaText: banner.bnn_cta_text,
      ctaUrl: banner.bnn_cta_url,
      imageUrl: banner.bnn_image_url,
      publicId: banner.bnn_public_id,
      displayOrder: banner.bnn_display_order,
      isActive: banner.bnn_is_active,
      startDate: banner.bnn_start_date,
      endDate: banner.bnn_end_date,
      createdBy: banner.bnn_created_by,
      updatedBy: banner.bnn_updated_by,
      createdAt: banner.createdAt,
      updatedAt: banner.updatedAt,
    };
  }
}

module.exports = BannerRepository;
