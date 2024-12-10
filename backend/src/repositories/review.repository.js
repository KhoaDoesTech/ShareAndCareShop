'use strict';
const BaseRepository = require('./base.repository');
const reviewModels = require('../models/review.model');

class ReviewRepository extends BaseRepository {
  constructor() {
    super(reviewModels);
    this.model = reviewModels;
  }

  formatDocument(review) {
    if (!review) return null;

    return {
      id: review._id,
      content: review.rvw_content,
      star: review.rvw_star,
      userId: review.rvw_user_id,
      productId: review.rvw_product_id,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }
}

module.exports = ReviewRepository;
