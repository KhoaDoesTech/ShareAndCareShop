// review.repository.js
'use strict';
const BaseRepository = require('./base.repository');
const reviewModels = require('../models/review.model');
const { listResponse } = require('../utils/helpers');
const { image } = require('../helpers/cloudinary.helper');

class ReviewRepository extends BaseRepository {
  constructor() {
    super(reviewModels);
    this.model = reviewModels;
  }

  async getReviewStats({ startDate, endDate } = {}) {
    const match = {};
    if (startDate && endDate) {
      match.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const stats = await this.model.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return stats;
  }

  async getReportStats({ startDate, endDate } = {}) {
    const match = { 'rvw_reports.createdAt': { $exists: true } };
    if (startDate && endDate) {
      match['rvw_reports.createdAt'] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const stats = await this.model.aggregate([
      { $match: match },
      { $unwind: '$rvw_reports' },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$rvw_reports.createdAt',
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return stats;
  }

  async getWorstRatedProducts(limit = 10) {
    const result = await this.model.aggregate([
      { $match: { rvw_star: { $lte: 2 }, rvw_is_hidden: false } },
      {
        $group: {
          _id: '$rvw_product_id',
          count: { $sum: 1 },
          averageStar: { $avg: '$rvw_star' },
        },
      },
      {
        $lookup: {
          from: 'Products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $project: {
          productId: '$_id',
          productName: '$product.prd_name',
          productImage: '$product.prd_main_image',
          count: 1,
          averageStar: { $round: ['$averageStar', 2] },
        },
      },
      { $sort: { count: -1, averageStar: 1 } },
      { $limit: limit },
    ]);

    return result;
  }

  formatDocument(review) {
    if (!review) return null;

    console.log(review);

    return {
      id: review._id,
      content: review.rvw_content,
      star: review.rvw_star,
      userId: review.rvw_user_id
        ? {
            id: review.rvw_user_id._id,
            name: review.rvw_user_id.usr_name,
            avatar: review.rvw_user_id.usr_avatar,
          }
        : null,
      orderId: review.rvw_order_id,
      productId: review.rvw_product_id,
      variantId: review.rvw_variant_id,
      images: review.rvw_images || [],
      reports: review.rvw_reports
        ? {
            count: review.rvw_reports.length,
            details: review.rvw_reports.map((report) => ({
              user: report.user_id
                ? {
                    id: report.user_id._id,
                    name: report.user_id.usr_name,
                    avatar: report.user_id.usr_avatar,
                  }
                : null,
              reason: report.reason,
              createdAt: report.createdAt,
            })),
          }
        : { count: 0, details: [] },
      isHidden: review.rvw_is_hidden,
      reply: review.rvw_reply
        ? {
            content: review.rvw_reply.rep_content,
            user: review.rvw_reply.rep_user
              ? {
                  id: review.rvw_reply.rep_user._id,
                  name: review.rvw_reply.rep_user.usr_name,
                  avatar: review.rvw_reply.rep_user.usr_avatar,
                }
              : null,
            createdAt: review.rvw_reply.createdAt,
          }
        : null,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }
}

module.exports = ReviewRepository;
