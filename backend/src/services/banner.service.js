'use strict';

const BannerRepository = require('../repositories/banner.repository');
const CategoryRepository = require('../repositories/category.repository');
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
const {
  AvailableBannerPositions,
  BannerPositions,
} = require('../constants/status');

class BannerService {
  constructor() {
    this.bannerRepository = new BannerRepository();
    this.uploadService = new UploadService();
    this.categoryRepository = new CategoryRepository();
  }

  async createBanner({
    userId,
    title,
    subtitle,
    ctaText,
    ctaUrl,
    imageUrl,
    isActive = true,
    startDate,
    endDate,
    position = BannerPositions.SLIDE,
    category = [],
  }) {
    // Validate dates if provided
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      throw new BadRequestError('End date must be after start date');
    }

    if (!imageUrl) {
      throw new BadRequestError('Image is required');
    }

    // Validate position
    if (!AvailableBannerPositions.includes(position)) {
      throw new BadRequestError(
        `Invalid position. Must be one of: ${AvailableBannerPositions.join(
          ', '
        )}`
      );
    }

    // Validate categories if position is 'category'
    let validatedCategories = [];
    if (position === BannerPositions.CATEGORY && category.length > 0) {
      validatedCategories = await this._validateCategories(category);
    } else if (position === BannerPositions.CATEGORY && category.length === 0) {
      throw new BadRequestError(
        'Category is required when position is "category"'
      );
    }

    const bnn_display_order =
      (await this.bannerRepository.getMaxDisplayOrder({
        position,
        categoryId: category.length ? category[0] : null,
      })) + 1;

    const newBanner = await this.bannerRepository.create({
      bnn_title: title,
      bnn_subtitle: subtitle,
      bnn_cta_text: ctaText,
      bnn_cta_url: ctaUrl,
      bnn_image_url: imageUrl,
      bnn_public_id: extractPublicIdFromUrl(imageUrl),
      bnn_display_order,
      bnn_is_active: isActive,
      bnn_start_date: startDate,
      bnn_end_date: endDate,
      bnn_position: position,
      bnn_category: validatedCategories,
      bnn_created_by: convertToObjectIdMongodb(userId),
      bnn_updated_by: convertToObjectIdMongodb(userId),
    });

    if (!newBanner) {
      throw new BadRequestError('Failed to create banner');
    }

    await this.uploadService.deleteUsedImages([imageUrl]);

    return pickFields({
      fields: [
        'id',
        'title',
        'imageUrl',
        'isActive',
        'displayOrder',
        'position',
        'category',
      ],
      object: newBanner,
    });
  }

  async updateBanner({
    bannerId,
    userId,
    title,
    subtitle,
    ctaText,
    ctaUrl,
    imageUrl,
    displayOrder,
    isActive,
    startDate,
    endDate,
    position,
    category,
  }) {
    const foundBanner = await this.bannerRepository.getBanner(bannerId);
    if (!foundBanner) {
      throw new NotFoundError('Banner not found');
    }

    // Validate dates if provided
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      throw new BadRequestError('End date must be after start date');
    }

    // Validate position
    if (!AvailableBannerPositions.includes(position)) {
      throw new BadRequestError(
        `Invalid position. Must be one of: ${AvailableBannerPositions.join(
          ', '
        )}`
      );
    }

    // Validate categories if position is 'category'
    let validatedCategories;
    if (
      position === BannerPositions.CATEGORY ||
      (position === undefined &&
        foundBanner.position === BannerPositions.CATEGORY)
    ) {
      if (category && category.length > 0) {
        validatedCategories = await this._validateCategories(category);
      } else if (category && category.length === 0) {
        throw new BadRequestError(
          'Category is required when position is "category"'
        );
      }
    }

    const updateData = removeUndefinedObject({
      bnn_title: title,
      bnn_subtitle: subtitle,
      bnn_cta_text: ctaText,
      bnn_cta_url: ctaUrl,
      bnn_image_url: imageUrl,
      bnn_public_id: imageUrl ? extractPublicIdFromUrl(imageUrl) : undefined,
      bnn_display_order: displayOrder,
      bnn_is_active: isActive,
      bnn_start_date: startDate,
      bnn_end_date: endDate,
      bnn_position: position,
      bnn_category: validatedCategories,
      bnn_updated_by: convertToObjectIdMongodb(userId),
    });

    const updatedBanner = await this.bannerRepository.updateById(
      foundBanner.id,
      updateNestedObjectParser(updateData)
    );

    if (!updatedBanner) {
      throw new BadRequestError('Failed to update banner');
    }

    if (imageUrl && imageUrl !== foundBanner.imageUrl) {
      await this.uploadService.deleteUsedImages([imageUrl]);
      if (foundBanner.imageUrl) {
        await this.uploadService.deleteUsedImages([foundBanner.imageUrl]);
      }
    }

    return pickFields({
      fields: [
        'id',
        'title',
        'imageUrl',
        'isActive',
        'displayOrder',
        'position',
        'category',
      ],
      object: updatedBanner,
    });
  }

  async publishBanner({ bannerId }) {
    const foundBanner = await this.bannerRepository.getBanner(bannerId);
    if (!foundBanner) {
      throw new NotFoundError('Banner not found');
    }

    const updatedBanner = await this.bannerRepository.updateById(
      foundBanner.id,
      {
        bnn_is_active: true,
      }
    );

    return pickFields({
      fields: ['id', 'isActive', 'updatedAt'],
      object: updatedBanner,
    });
  }

  async unpublishBanner({ bannerId }) {
    const foundBanner = await this.bannerRepository.getBanner(bannerId);
    if (!foundBanner) {
      throw new NotFoundError('Banner not found');
    }

    const updatedBanner = await this.bannerRepository.updateById(
      foundBanner.id,
      {
        bnn_is_active: false,
      }
    );

    return pickFields({
      fields: ['id', 'isActive', 'updatedAt'],
      object: updatedBanner,
    });
  }

  async deleteBanner({ bannerId }) {
    const foundBanner = await this.bannerRepository.getBanner(bannerId);
    if (!foundBanner) {
      throw new NotFoundError('Banner not found');
    }

    const updatedBanner = await this.bannerRepository.updateById(
      foundBanner.id,
      {
        bnn_is_active: false,
      }
    );

    return pickFields({
      fields: ['id', 'isActive', 'updatedAt'],
      object: updatedBanner,
    });
  }

  async getAllBanners({ page = 1, size = 10, sort = '-createdAt' }) {
    const formatPage = parseInt(page);
    const formatSize = parseInt(size);

    const mappedSort = sort.includes('displayOrder')
      ? sort.replace('displayOrder', 'bnn_display_order')
      : sort;

    const query = {
      sort: mappedSort,
      page: formatPage,
      size: formatSize,
    };

    const {
      groupedBanners,
      total,
      page: currentPage,
      size: currentSize,
    } = await this.bannerRepository.getAllGroupedByPosition({
      queryOptions: query,
    });

    return listResponse({
      items: groupedBanners,
      total,
      page: currentPage,
      size: currentSize,
    });
  }

  async getActiveBanners({ page = 1, size = 10, position, categoryId }) {
    const formatPage = parseInt(page);
    const formatSize = parseInt(size);

    if (position === BannerPositions.CATEGORY && !categoryId) {
      throw new BadRequestError(
        'Category ID is required for category position'
      );
    }

    const banners = await this.bannerRepository.getActiveBanners({
      position,
      categoryId,
    });
    const totalBanners = banners.length;

    const paginatedBanners = banners.slice(
      (formatPage - 1) * formatSize,
      formatPage * formatSize
    );

    return listResponse({
      items: paginatedBanners.map((banner) =>
        pickFields({
          fields: ['id', 'title', 'subtitle', 'ctaText', 'ctaUrl', 'imageUrl'],
          object: banner,
        })
      ),
      total: totalBanners,
      page: formatPage,
      size: formatSize,
    });
  }

  async getBannerDetails({ bannerId }) {
    const foundBanner = await this.bannerRepository.getBanner(bannerId);
    if (!foundBanner) {
      throw new NotFoundError('Banner not found');
    }

    return foundBanner;
  }

  async _validateCategories(categories) {
    if (!categories || !categories.length) return [];

    const validCategories = [];
    await Promise.all(
      categories.map(async (id) => {
        const categoryData = await this.categoryRepository.getById(id);
        if (!categoryData) {
          throw new BadRequestError(`Category not found with ID ${id}`);
        }
        validCategories.push(categoryData);
      })
    );

    return validCategories.map((category) => ({
      id: category.id,
      name: category.name,
    }));
  }
}

module.exports = BannerService;
