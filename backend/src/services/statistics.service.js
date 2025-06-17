'use strict';

const OrderRepository = require('../repositories/order.repository');
const ProductRepository = require('../repositories/product.repository');
const ReviewRepository = require('../repositories/review.repository');
const UserRepository = require('../repositories/user.repository');
const InventoryRepository = require('../repositories/inventory.repository');
const RefundLogRepository = require('../repositories/refundLog.repository');
const CategoryService = require('./category.service');
const { listResponse } = require('../utils/helpers');
const { RefundStatus, OrderStatus } = require('../constants/status');
class StatisticsService {
  constructor() {
    this.orderRepository = new OrderRepository();
    this.productRepository = new ProductRepository();
    this.userRepository = new UserRepository();
    this.reviewRepository = new ReviewRepository();
    this.inventoryRepository = new InventoryRepository();
    this.refundLogRepository = new RefundLogRepository();
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
  async getReturnRate({ startDate, endDate, page = 1, size = 10 } = {}) {
    this._validateDateRange(startDate, endDate);

    const skip = (page - 1) * size;
    const refundMatch = { rfl_status: RefundStatus.COMPLETED };
    const orderMatch = { ord_status: OrderStatus.DELIVERED };

    if (startDate && endDate) {
      refundMatch.rfl_requested_at = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
      orderMatch.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Tính totalReturned từ RefundLog
    const totalReturnedArr = await this.refundLogRepository.model.aggregate([
      { $match: refundMatch },
      {
        $group: {
          _id: '$rfl_item.prd_id',
          totalReturned: { $sum: '$rfl_item.prd_quantity' },
        },
      },
      {
        $project: {
          productId: '$_id',
          totalReturned: 1,
          _id: 0,
        },
      },
    ]);

    // Tính totalSold từ Order
    const totalSoldArr = await this.orderRepository.model.aggregate([
      { $match: orderMatch },
      { $unwind: '$ord_items' },
      {
        $group: {
          _id: '$ord_items.prd_id',
          totalSold: { $sum: '$ord_items.prd_quantity' },
        },
      },
      {
        $project: {
          productId: '$_id',
          totalSold: 1,
          _id: 0,
        },
      },
    ]);

    // Tạo map để tra cứu nhanh
    const totalReturnedMap = new Map();
    totalReturnedArr.forEach((item) => {
      totalReturnedMap.set(String(item.productId), item.totalReturned);
    });
    const totalSoldMap = new Map();
    totalSoldArr.forEach((item) => {
      totalSoldMap.set(String(item.productId), item.totalSold);
    });

    // Lấy danh sách sản phẩm
    const products = await this.productRepository.model.find(
      {},
      {
        _id: 1,
        prd_name: 1,
        prd_main_image: 1,
      }
    );

    // Kết hợp dữ liệu và tính returnRate
    const combined = products
      .map((product) => {
        const productId = String(product._id);
        const totalSold = totalSoldMap.get(productId) || 0;
        const totalReturned = totalReturnedMap.get(productId) || 0;
        const returnRate = totalSold === 0 ? 0 : totalReturned / totalSold;
        return {
          productId: product._id,
          productName: product.prd_name,
          mainImage: product.prd_main_image,
          totalSold,
          totalReturned,
          returnRate,
        };
      })
      .filter((item) => item.totalSold > 0 || item.totalReturned > 0);

    // Sắp xếp theo returnRate giảm dần
    combined.sort((a, b) => b.returnRate - a.returnRate);

    // Phân trang
    const paged = combined.slice(skip, skip + size);

    return listResponse({
      items: paged,
      total: combined.length,
      page,
      size,
    });
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
