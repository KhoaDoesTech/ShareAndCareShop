const StatisticsService = require('../services/statistics.service');
const { ActionSuccess } = require('../utils/successResponse');

class StatisticsController {
  constructor() {
    this.statisticsService = new StatisticsService();
  }

  getReportCountRecords = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy thống kê tổng quan thành công',
      metadata: await this.statisticsService.getReportCountRecords(),
    }).send(res);
  };

  getReviewStats = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy thống kê đánh giá thành công',
      metadata: await this.statisticsService.getReviewStats(req.query),
    }).send(res);
  };
}

module.exports = new StatisticsController();
