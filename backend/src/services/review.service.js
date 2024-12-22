'use strict';
const { OrderStatus, ProductStatus } = require('../constants/status');
const OrderRepository = require('../repositories/order.repository');
const ProductRepository = require('../repositories/product.repository');
const reviewRepository = require('../repositories/review.repository');

class ReviewService {
  constructor() {
    this.reviewRepository = new reviewRepository();
    this.orderRepository = new OrderRepository();
    this.productRepository = new ProductRepository();
  }

  // TODO implement create
  async createReview({ userId, productId, star, content }) {
    const product = await this.productRepository.getById(productId);

    const newReview = await this.reviewRepository.create({
      rvw_user_id: userId,
      rvw_product_id: product.id,
      rvw_star: star,
      rvw_content: content,
    });

    return newReview;
  }

  async replyReview({ userId, reviewId, content }) {
    const review = await this.reviewRepository.getById(reviewId);

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
    const orders = await this.orderRepository.getAll({
      filter: {
        ord_user_id: userId,
        ord_status: OrderStatus.DELIVERED,
      },
    });

    console.log(orders);

    const productIds = orders?.flatMap((order) =>
      order.items.map((item) => item.productId)
    );

    console.log(productIds);

    const reviewedProducts = await this.reviewRepository.getAll({
      filter: { rv_user_id: userId },
    });

    console.log(reviewedProducts);

    const reviewedProductIds = new Set(
      reviewedProducts.map((review) => review.productId.toString())
    );

    const productsCanReview = productIds.filter(
      (productId) => !reviewedProductIds.has(productId)
    );

    console.log(productsCanReview);

    const products = await this.productRepository.getAll({
      filter: {
        _id: { $in: productsCanReview },
        prd_status: {
          $in: [ProductStatus.PUBLISHED, ProductStatus.OUT_OF_STOCK],
        },
      },
    });

    return products;
  }
}

module.exports = ReviewService;
