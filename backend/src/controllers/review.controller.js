const ReviewService = require('../services/review.service');
const { ActionSuccess } = require('../utils/successResponse');

class ReviewController {
  constructor() {
    this.reviewService = new ReviewService();
  }

  createReview = async (req, res, next) => {
    new ActionSuccess({
      message: 'Tạo đánh giá thành công',
      metadata: await this.reviewService.createReview({
        userId: req.user.id,
        ...req.body,
      }),
    }).send(res);
  };

  replyReview = async (req, res, next) => {
    new ActionSuccess({
      message: 'Phản hồi đánh giá thành công',
      metadata: await this.reviewService.replyReview({
        userId: req.user.id,
        reviewId: req.params.reviewId,
        content: req.body.content,
      }),
    }).send(res);
  };

  reportReview = async (req, res) => {
    new ActionSuccess({
      message: 'Báo cáo đánh giá thành công',
      metadata: await this.reviewService.reportReview({
        userId: req.user.id,
        reviewId: req.params.reviewId,
        reason: req.body.reason,
      }),
    }).send(res);
  };

  getReviewsByProduct = async (req, res) => {
    const { productId } = req.params;
    const { sort, page = 1, size = 10, rating, hasImage } = req.query;

    new ActionSuccess({
      message: 'Lấy danh sách đánh giá thành công',
      metadata: await this.reviewService.getReviewsByProduct({
        productId,
        sort,
        page,
        size,
        rating: rating ? parseInt(rating) : undefined,
        hasImage,
      }),
    }).send(res);
  };

  getReviewsDetailsByUser = async (req, res) => {
    new ActionSuccess({
      message: 'Lấy chi tiết đánh giá của người dùng thành công',
      metadata: await this.reviewService.getReviewsDetailsByUser({
        userId: req.user.id,
        ...req.query,
      }),
    }).send(res);
  };

  getUnrepliedReviews = async (req, res) => {
    new ActionSuccess({
      message: 'Lấy danh sách đánh giá chưa phản hồi thành công',
      metadata: await this.reviewService.getUnrepliedReviews(req.query),
    }).send(res);
  };

  getReviewById = async (req, res) => {
    new ActionSuccess({
      message: 'Lấy đánh giá thành công',
      metadata: await this.reviewService.getReviewById(req.params),
    }).send(res);
  };

  hideReview = async (req, res) => {
    new ActionSuccess({
      message: 'Ẩn đánh giá thành công',
      metadata: await this.reviewService.hideReview(req.params),
    }).send(res);
  };
}

module.exports = new ReviewController();
