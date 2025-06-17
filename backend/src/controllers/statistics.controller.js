const StatisticsService = require('../services/statistics.service');
const { ActionSuccess } = require('../utils/successResponse');

class StatisticsController {
  constructor() {
    this.statisticsService = new StatisticsService();
  }

  getReportCountRecords = async (req, res) => {
    const data = await this.statisticsService.getReportCountRecords();
    new ActionSuccess({
      message: 'Lấy thống kê tổng quan thành công',
      metadata: data,
    }).send(res);
  };

  getReviewStats = async (req, res) => {
    const data = await this.statisticsService.getReviewStats(req.query);
    new ActionSuccess({
      message: 'Lấy thống kê đánh giá thành công',
      metadata: data,
    }).send(res);
  };

  getBasicStats = async (req, res) => {
    const data = await this.statisticsService.getBasicStats(req.query);
    new ActionSuccess({
      message: 'Lấy thống kê cơ bản thành công',
      metadata: data,
    }).send(res);
  };

  getRevenueByCategory = async (req, res) => {
    const data = await this.statisticsService.getRevenueByCategory(req.query);
    new ActionSuccess({
      message: 'Lấy thống kê doanh thu theo danh mục thành công',
      metadata: data,
    }).send(res);
  };

  getRevenueTrend = async (req, res) => {
    const data = await this.statisticsService.getRevenueTrend(req.query);
    new ActionSuccess({
      message: 'Lấy thống kê xu hướng doanh thu thành công',
      metadata: data,
    }).send(res);
  };

  getTopSellingProducts = async (req, res) => {
    const data = await this.statisticsService.getTopSellingProducts(req.query);
    new ActionSuccess({
      message: 'Lấy sản phẩm bán chạy thành công',
      metadata: data,
    }).send(res);
  };

  getReturnRate = async (req, res) => {
    const data = await this.statisticsService.getReturnRate(req.query);
    new ActionSuccess({
      message: 'Lấy thống kê tỷ lệ hoàn trả thành công',
      metadata: data,
    }).send(res);
  };

  getImportProfitAnalysis = async (req, res) => {
    const data = await this.statisticsService.getImportProfitAnalysis(
      req.query
    );
    new ActionSuccess({
      message: 'Lấy thống kê hiệu quả nhập kho thành công',
      metadata: data,
    }).send(res);
  };
}

module.exports = new StatisticsController();
