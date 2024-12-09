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

router.get(
  '/count',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.PAGE.DASHBOARD),
  asyncHandler(StatisticsController.getReportCountRecords)
);

module.exports = router;
