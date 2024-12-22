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

  createReview = async (req, res, next) => {
    new ActionSuccess({
      message: 'Review created successfully',
      metadata: await this.reviewService.createReview({
        userId: req.user.id,
        ...req.body,
      }),
    }).send(res);
  };

  replyReview = async (req, res, next) => {
    new ActionSuccess({
      message: 'Review replied successfully',
      metadata: await this.reviewService.replyReview({
        userId: req.user.id,
        ...req.body,
      }),
    }).send(res);
  };
}

module.exports = new ReviewController();
