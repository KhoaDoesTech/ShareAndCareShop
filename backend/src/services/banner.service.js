'use strict';

const BannerRepository = require('../repositories/banner.repository');
const UploadService = require('./upload.service');
const { BadRequestError, NotFoundError } = require('../utils/errorResponse');
const {
  omitFields,
  removeUndefinedObject,
  updateNestedObjectParser,
  pickFields,
  listResponse,
  extractPublicIdFromUrl,
} = require('../utils/helpers');
const { convertToObjectIdMongodb } = require('../utils/helpers');

class BannerService {
  constructor() {
    this.bannerRepository = new BannerRepository();
    this.uploadService = new UploadService();
  }

  async createBanner({
    userId,
    title,
    subtitle,
    ctaText,
    ctaUrl,
    imageUrl,
    displayOrder = 0,
    isActive = true,
    startDate,
    endDate,
  }) {
    // Validate ngày bắt đầu và kết thúc
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      throw new BadRequestError('Ngày kết thúc phải sau ngày bắt đầu');
    }

    if (!imageUrl) {
      throw new BadRequestError('Hình ảnh là bắt buộc');
    }

    const newBanner = await this.bannerRepository.create({
      bnn_title: title,
      bnn_subtitle: subtitle,
      bnn_cta_text: ctaText,
      bnn_cta_url: ctaUrl,
      bnn_image_url: imageUrl,
      bnn_public_id: extractPublicIdFromUrl(imageUrl),
      bnn_display_order: displayOrder,
      bnn_is_active: isActive,
      bnn_start_date: startDate,
      bnn_end_date: endDate,
      bnn_created_by: userId,
      bnn_updated_by: userId,
    });

    if (!newBanner) {
      throw new BadRequestError('Tạo banner thất bại');
    }

    this.uploadService.deleteUsedImages([imageUrl]);
    console.log(newBanner);
    return pickFields({
      fields: ['id', 'title', 'imageUrl', 'isActive'],
      object: newBanner,
    });
  }
}

module.exports = BannerService;
