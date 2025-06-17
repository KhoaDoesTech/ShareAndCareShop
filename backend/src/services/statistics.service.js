'use strict';

const OrderRepository = require('../repositories/order.repository');
const ProductRepository = require('../repositories/product.repository');
const ReviewRepository = require('../repositories/review.repository');
const UserRepository = require('../repositories/user.repository');
const InventoryRepository = require('../repositories/inventory.repository');
class StatisticsService {
  constructor() {
    this.orderRepository = new OrderRepository();
    this.productRepository = new ProductRepository();
    this.userRepository = new UserRepository();
    this.reviewRepository = new ReviewRepository();
    this.inventoryRepository = new InventoryRepository();
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
    this._validateDateRange(startDate, endDate);

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

  async getBasicStats({ startDate, endDate } = {}) {
    this._validateDateRange(startDate, endDate);

    const [totalRevenue, orderStatusCount] = await Promise.all([
      this.orderRepository.totalRevenue({ startDate, endDate }),
      this.orderRepository.orderStatusCount({ startDate, endDate }),
    ]);

    return {
      totalRevenue: totalRevenue.totalRevenue,
      totalOrders: totalRevenue.totalOrders,
      orderStatusCounts: orderStatusCount,
    };
  }

  // Thống kê xu hướng doanh thu
  async getRevenueTrend({ startDate, endDate, groupBy = 'day' } = {}) {
    this._validateDateRange(startDate, endDate);
    const trend = await this.orderRepository.revenueTrend({
      startDate,
      endDate,
      groupBy,
    });
    return trend;
  }

  // Thống kê doanh thu theo danh mục
  async getRevenueByCategory({ startDate, endDate } = {}) {
    this._validateDateRange(startDate, endDate);
    const categoryStats = await this.orderRepository.revenueByCategory({
      startDate,
      endDate,
    });
    return categoryStats;
  }

  // Thống kê sản phẩm bán chạy
  async getTopSellingProducts({ limit = 10, startDate, endDate } = {}) {
    this._validateDateRange(startDate, endDate);
    const topProducts = await this.orderRepository.topSellingProducts({
      limit,
      startDate,
      endDate,
    });
    return topProducts;
  }

  // Thống kê tỷ lệ hoàn trả
  async getReturnRate({ startDate, endDate } = {}) {
    this._validateDateRange(startDate, endDate);
    const returnStats = await this.orderRepository.returnRate({
      startDate,
      endDate,
    });
    return returnStats;
  }

  // Thống kê hiệu quả nhập kho
  async getImportProfitAnalysis({ startDate, endDate } = {}) {
    this._validateDateRange(startDate, endDate);
    const profitAnalysis = await this.inventoryRepository.importProfitAnalysis({
      startDate,
      endDate,
    });
    return profitAnalysis;
  }

  _validateDateRange(startDate, endDate) {
    if (startDate && endDate) {
      if (new Date(startDate) >= new Date(endDate)) {
        throw new Error('Start date must be before end date');
      }
    }
  }
}

module.exports = StatisticsService;
