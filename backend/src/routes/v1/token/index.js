'use strict';

const express = require('express');
const TokenController = require('../../../controllers/token.controller');
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

router.get('/', authentication, asyncHandler(TokenController.getTokens));

router.patch(
  '/',
  authentication,
  asyncHandler(TokenController.updateDeviceName)
);

router.delete('/', authentication, asyncHandler(TokenController.deleteToken));

router.delete(
  '/all',
  authentication,
  asyncHandler(TokenController.deleteAllTokens)
);

module.exports = router;
