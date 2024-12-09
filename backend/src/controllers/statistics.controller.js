const StatisticsService = require('../services/statistics.service');
const { ActionSuccess } = require('../utils/successResponse');

class StatisticsController {
  constructor() {
    this.statisticsService = new StatisticsService();
  }

  getReportCountRecords = async (req, res, next) => {
    new ActionSuccess({
      message: 'Report count records retrieved successfully',
      metadata: await this.statisticsService.getReportCountRecords(),
    }).send(res);
  };
}

module.exports = new StatisticsController();
