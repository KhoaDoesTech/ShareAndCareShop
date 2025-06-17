'use strict';

const BannerModel = require('../models/banner.model');
const { convertToObjectIdMongodb } = require('../utils/helpers');
const BaseRepository = require('./base.repository');

class BannerRepository extends BaseRepository {
  constructor() {
    super(BannerModel);
    this.model = BannerModel;
  }

  async getActiveBanners({ position, categoryId }) {
    const now = new Date();
    const filter = {
      bnn_is_active: true,
      $or: [
        { bnn_start_date: { $lte: now }, bnn_end_date: { $gte: now } },
        { bnn_start_date: null, bnn_end_date: null },
        { bnn_start_date: { $lte: now }, bnn_end_date: null },
        { bnn_start_date: null, bnn_end_date: { $gte: now } },
      ],
    };

    if (position) {
      filter.bnn_position = position;
    }

    if (categoryId) {
      filter['bnn_category.id'] = convertToObjectIdMongodb(categoryId);
    }

    const banners = await this.model
      .find(filter)
      .sort({ bnn_display_order: 1, createdAt: -1 })
      .lean();
    return banners.map(this.formatDocument);
  }

  async getMaxDisplayOrder({ position, categoryId }) {
    const filter = { bnn_position: position };
    if (categoryId) {
      filter['bnn_category.id'] = convertToObjectIdMongodb(categoryId);
    }
    const banner = await this.model
      .findOne(filter)
      .sort({ bnn_display_order: -1 })
      .select('bnn_display_order')
      .lean();
    return banner ? banner.bnn_display_order : 0;
  }

  async getBanner(identifier) {
    let query = {};
    if (this.model.Types.ObjectId.isValid(identifier)) {
      query = { _id: identifier };
    } else {
      query = { bnn_public_id: identifier };
    }
    return this.formatDocument(await this.model.findOne(query).lean());
  }

  async getAllGroupedByPosition({ filter = {}, queryOptions = {} }) {
    const { sort = '-createdAt', page = 1, size = 10 } = queryOptions;
    const skip = (page - 1) * size;

    const aggregation = [
      { $match: filter },
      {
        $sort: {
          [sort.startsWith('-') ? sort.slice(1) : sort]: sort.startsWith('-')
            ? -1
            : 1,
        },
      },
      {
        $group: {
          _id: '$bnn_position',
          banners: { $push: '$$ROOT' },
        },
      },
      {
        $project: {
          position: '$_id',
          banners: {
            $slice: ['$banners', skip, size],
          },
          total: { $size: '$banners' },
        },
      },
    ];

    const result = await this.model.aggregate(aggregation);
    const groupedBanners = result.reduce(
      (acc, { position, banners, total }) => {
        acc[position] = {
          items: banners.map(this.formatDocument),
          total,
        };
        return acc;
      },
      {}
    );

    const totalDocuments = await this.model.countDocuments(filter);

    return {
      groupedBanners,
      total: totalDocuments,
      page,
      size,
    };
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
      position: banner.bnn_position,
      category: banner.bnn_category?.map((cat) => ({
        id: cat.id,
        name: cat.name,
      })),
      createdBy: banner.bnn_created_by,
      updatedBy: banner.bnn_updated_by,
      createdAt: banner.createdAt,
      updatedAt: banner.updatedAt,
    };
  }
}

module.exports = BannerRepository;
