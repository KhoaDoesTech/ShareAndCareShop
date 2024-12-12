const ReviewService = require('../services/review.service');
const { ActionSuccess } = require('../utils/successResponse');

class ReviewController {
  constructor() {
    this.reviewService = new ReviewService();
  }

  getProductCanReview = async (req, res, next) => {
    new ActionSuccess({
      message: 'Product can review retrieved successfully',
      metadata: await this.reviewService.getProductCanReview(req.user.id),
    }).send(res);
  };
}

module.exports = new ReviewController();
