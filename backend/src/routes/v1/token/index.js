'use strict';

const express = require('express');
const TokenController = require('../../../controllers/auth.controller');
const asyncHandler = require('../../../middlewares/async.middleware');
const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');

const router = express.Router();

// Secured routes
router.get(
  '/refresh-token',
  authentication,
  asyncHandler(TokenController.refreshAccessToken)
);

module.exports = router;
