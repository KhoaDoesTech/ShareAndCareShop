'use strict';

const express = require('express');
const validate = require('../../../middlewares/validate.middleware');
const asyncHandler = require('../../../middlewares/async.middleware');
const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');
const UserController = require('../../../controllers/user.controller');
const router = express.Router();

router.get(
  '/all',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SYSTEM.USER.VIEW),
  asyncHandler(UserController.getAllUsers)
);

module.exports = router;
