'use strict';
const { OrderStatus, ProductStatus } = require('../constants/status');
const OrderRepository = require('../repositories/order.repository');
const ProductRepository = require('../repositories/product.repository');
const reviewRepository = require('../repositories/review.repository');
const { BadRequestError } = require('../utils/errorResponse');

class ReviewService {
  constructor() {
    this.reviewRepository = new reviewRepository();
    this.orderRepository = new OrderRepository();
    this.productRepository = new ProductRepository();
  }

  // TODO implement create
  async createReview({ userId, productId, star, content }) {
    this._validateReviewParams({ userId, productId, star, content });

    const product = await this.productRepository.getById(productId);
    if (!product) {
      throw new BadRequestError('Product not found');
    }

    const canReview = await this._canReviewProduct(userId, productId);
    if (!canReview) {
      throw new BadRequestError(
        'You can only review products you have purchased and not yet reviewed'
      );
    }

    const newReview = await this.reviewRepository.create({
      rvw_user_id: userId,
      rvw_product_id: product.id,
      rvw_star: star,
      rvw_content: content,
    });

    const averageStar = await this._calculateAverageStar(productId);
    await this.productRepository.updateById(productId, {
      prd_rating: averageStar,
    });

    return { review: newReview, averageStar };
  }

  async _calculateAverageStar(productId) {
    if (!productId) {
      throw new BadRequestError(
        'Product ID is required to calculate average stars'
      );
    }

    const reviews = await this.reviewRepository.getAll({
      filter: { rvw_product_id: productId },
    });

    if (!reviews || reviews.length === 0) {
      return 0;
    }

    const totalStars = reviews.reduce(
      (sum, review) => sum + review.rvw_star,
      0
    );
    const averageStar = totalStars / reviews.length;

    return parseFloat(averageStar.toFixed(2));
  }

  _validateReviewParams({ userId, productId, star, content }) {
    if (!userId || !productId || !star || !content) {
      throw new Error('Missing required parameters for creating a review');
    }
    if (star < 1 || star > 5) {
      throw new Error('Star rating must be between 1 and 5');
    }
  }

  async _getPurchasedProductIds(userId) {
    const orders = await this.orderRepository.getAll({
      filter: {
        ord_user_id: userId,
        ord_status: OrderStatus.DELIVERED,
      },
    });

    return orders.flatMap((order) =>
      order.items.map((item) => item.productId.toString())
    );
  }

  async _getReviewedProductIds(userId) {
    const reviews = await this.reviewRepository.getAll({
      filter: { rvw_user_id: userId },
    });

    return new Set(reviews.map((review) => review.rvw_product_id.toString()));
  }

  async _getProductsByIds(
    productIds,
    statusFilter = [ProductStatus.PUBLISHED, ProductStatus.OUT_OF_STOCK]
  ) {
    if (!productIds || productIds.length === 0) {
      return [];
    }

    return await this.productRepository.getAll({
      filter: {
        _id: { $in: productIds },
        prd_status: { $in: statusFilter },
      },
    });
  }

  async _canReviewProduct(userId, productId) {
    const purchasedProductIds = await this._getPurchasedProductIds(userId);
    const reviewedProductIds = await this._getReviewedProductIds(userId);

    return (
      purchasedProductIds.includes(productId.toString()) &&
      !reviewedProductIds.has(productId.toString())
    );
  }

  async replyReview({ userId, reviewId, content }) {
    const review = await this.reviewRepository.getById(reviewId);
    if (!review) {
      throw new BadRequestError('Review not found');
    }

    const newReview = await this.reviewRepository.updateById(review.id, {
      rvw_reply: {
        rep_content: content,
        rep_user: userId,
        createdAt: new Date(),
      },
    });

    return newReview;
  }

  async getProductCanReview(userId) {
    const purchasedProductIds = await this._getPurchasedProductIds(userId);
    const reviewedProductIds = await this._getReviewedProductIds(userId);

    const productsToReviewIds = purchasedProductIds.filter(
      (productId) => !reviewedProductIds.has(productId)
    );

    const products = await this._getProductsByIds(productsToReviewIds);

    return products;
  }
}

module.exports = ReviewService;
