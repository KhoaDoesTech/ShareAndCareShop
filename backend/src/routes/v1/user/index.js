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

router.patch(
  '/change-password',
  authentication,
  asyncHandler(UserController.changePassword)
);

router.get(
  '/all',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SYSTEM.USER.VIEW),
  asyncHandler(UserController.getAllUsers)
);

router.patch(
  '/assign-role/:userId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SYSTEM.USER.UPDATE),
  asyncHandler(UserController.changeRole)
);

router.patch(
  '/block/:userId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SYSTEM.USER.UPDATE),
  asyncHandler(UserController.blockUser)
);

router.patch(
  '/unblock/:userId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SYSTEM.USER.UPDATE),
  asyncHandler(UserController.unBlockUser)
);

module.exports = router;
