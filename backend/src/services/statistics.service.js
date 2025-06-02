'use strict';

const OrderRepository = require('../repositories/order.repository');
const ProductRepository = require('../repositories/product.repository');
const ReviewRepository = require('../repositories/review.repository');
const UserRepository = require('../repositories/user.repository');

class StatisticsService {
  constructor() {
    this.orderRepository = new OrderRepository();
    this.productRepository = new ProductRepository();
    this.userRepository = new UserRepository();
    this.reviewRepository = new ReviewRepository();
  }

  async getReportCountRecords() {
    const orderCount = await this.orderRepository.countDocuments();
    const productCount = await this.productRepository.countDocuments();
    const userCount = await this.userRepository.countDocuments();
    const soldProduct = await this.orderRepository.totalProductsSold();

    return {
      orderCount,
      productCount,
      userCount,
      soldProduct,
    };
  }

  async getReviewStats({ startDate, endDate } = {}) {
    _validateDateRange(startDate, endDate);

    const reviewStats = await this.reviewRepository.getReviewStats({
      startDate,
      endDate,
    });

    const reportStats = await this.reviewRepository.getReportStats({
      startDate,
      endDate,
    });

    const worstRatedProducts =
      await this.reviewRepository.getWorstRatedProducts();

    return {
      reviewStats,
      reportStats,
      worstRatedProducts,
    };
  }

  // async getReportTotalRevenue() {
  //   const totalRevenue = await this.orderRepository.totalRevenue();

  //   return totalRevenue;
  // }

  // async getOrderStatistics() {
  //   const orderStatistics = await this.orderRepository.getOrderStatistics();

  //   return orderStatistics;
  // }

  _validateDateRange(startDate, endDate) {
    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required');
    }
    if (new Date(startDate) >= new Date(endDate)) {
      throw new Error('Start date must be before end date');
    }
    if (new Date(endDate) <= new Date()) {
      throw new Error('End date must be in the future');
    }
  }
}

module.exports = StatisticsService;
