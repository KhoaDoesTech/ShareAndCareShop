'use strict';

const express = require('express');
const StatisticsController = require('../../../controllers/statistics.controller');
const asyncHandler = require('../../../middlewares/async.middleware');
const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');

const router = express.Router();

// Middleware áp dụng cho tất cả các route
router.use(authentication);
router.use(verifyPermission(CONFIG_PERMISSIONS.PAGE.DASHBOARD));

// Tổng quan
router.get('/count', asyncHandler(StatisticsController.getReportCountRecords));
router.get('/basic', asyncHandler(StatisticsController.getBasicStats));

// Đánh giá
router.get('/reviews', asyncHandler(StatisticsController.getReviewStats));

// Doanh thu
router.get(
  '/revenue/category',
  asyncHandler(StatisticsController.getRevenueByCategory)
);
router.get(
  '/revenue/trend',
  asyncHandler(StatisticsController.getRevenueTrend)
);

// Sản phẩm
router.get(
  '/products/top-selling',
  asyncHandler(StatisticsController.getTopSellingProducts)
);

// Đơn hàng và kho
router.get(
  '/orders/return-rate',
  asyncHandler(StatisticsController.getReturnRate)
);
router.get(
  '/inventory/profit-analysis',
  asyncHandler(StatisticsController.getImportProfitAnalysis)
);

module.exports = router;
