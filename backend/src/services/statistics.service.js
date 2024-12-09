'use strict';

const OrderRepository = require('../repositories/order.repository');
const ProductRepository = require('../repositories/product.repository');
const UserRepository = require('../repositories/user.repository');

class StatisticsService {
  constructor() {
    this.orderRepository = new OrderRepository();
    this.productRepository = new ProductRepository();
    this.userRepository = new UserRepository();
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

  // async getReportTotalRevenue() {
  //   const totalRevenue = await this.orderRepository.totalRevenue();

  //   return totalRevenue;
  // }

  // async getOrderStatistics() {
  //   const orderStatistics = await this.orderRepository.getOrderStatistics();

  //   return orderStatistics;
  // }
}

module.exports = StatisticsService;
