'use strict';

const OrderRepository = require('../repositories/order.repository');
const ProductRepository = require('../repositories/product.repository');
const ReviewRepository = require('../repositories/review.repository');
const UserRepository = require('../repositories/user.repository');
const InventoryRepository = require('../repositories/inventory.repository');
const CategoryService = require('./category.service');
const { listResponse } = require('../utils/helpers');
class StatisticsService {
  constructor() {
    this.orderRepository = new OrderRepository();
    this.productRepository = new ProductRepository();
    this.userRepository = new UserRepository();
    this.reviewRepository = new ReviewRepository();
    this.inventoryRepository = new InventoryRepository();
    this.categoryService = new CategoryService();
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
  async getRevenueByCategory({
    startDate,
    endDate,
    parentId = null,
    maxDepth = Infinity,
  }) {
    this._validateDateRange(startDate, endDate);
    const revenueByCategory = await this.orderRepository.getRevenueByCategory({
      startDate,
      endDate,
      parentId,
      maxDepth,
    });

    // Tạo map để tra cứu doanh thu theo categoryId
    const revenueMap = new Map();
    revenueByCategory.forEach((item) => {
      revenueMap.set(item.categoryId.toString(), {
        totalRevenue: item.totalRevenue,
        totalOrders: item.totalOrders,
      });
    });

    // Bước 2: Lấy danh sách danh mục và xây dựng cây
    const categories = await this.categoryService.getAllCategories({
      parentId,
      size: maxDepth,
    });

    // Bước 3: Gắn thông tin doanh thu vào cây danh mục
    const attachRevenueToTree = (node) => {
      const revenueData = revenueMap.get(node.id.toString()) || {
        totalRevenue: 0,
        totalOrders: 0,
      };
      return {
        id: node.id,
        name: node.name,
        parentId: node.parentId,
        totalRevenue: revenueData.totalRevenue,
        totalOrders: revenueData.totalOrders,
        children: node.children.map(attachRevenueToTree),
      };
    };

    return categories.map(attachRevenueToTree);
  }

  // Thống kê sản phẩm bán chạy
  async getTopSellingProducts({
    startDate,
    endDate,
    page = 1,
    size = 10,
  } = {}) {
    const formatPage = parseInt(page);
    const formatSize = parseInt(size);

    this._validateDateRange(startDate, endDate);
    const topSellingProducts = await this.orderRepository.getTopSellingProducts(
      {
        startDate,
        endDate,
        page: formatPage,
        size: formatSize,
      }
    );

    return listResponse({
      items: topSellingProducts.products,
      total: topSellingProducts.total,
      page: formatPage,
      size: formatSize,
    });
  }

  // Thống kê tỷ lệ hoàn trả
  async getReturnRate({ startDate, endDate, page, size } = {}) {}

  _validateDateRange(startDate, endDate) {
    if (startDate && endDate) {
      if (new Date(startDate) >= new Date(endDate)) {
        throw new Error('Start date must be before end date');
      }
    }
  }
}

module.exports = StatisticsService;
