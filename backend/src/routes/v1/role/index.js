'use strict';

const express = require('express');
const RoleController = require('../../../controllers/role.controller');
const asyncHandler = require('../../../middlewares/async.middleware');
const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');

const router = express.Router();

router.post(
  '/',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SYSTEM.ROLE.CREATE),
  asyncHandler(RoleController.createRole)
);

router.get(
  '/',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SYSTEM.ROLE.VIEW),
  asyncHandler(RoleController.getRoles)
);

router.get(
  '/:roleId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SYSTEM.ROLE.VIEW),
  asyncHandler(RoleController.getRoleById)
);

router.put(
  '/:roleId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SYSTEM.ROLE.UPDATE),
  asyncHandler(RoleController.updateRole)
);

router.delete(
  '/:roleId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SYSTEM.ROLE.DELETE),
  asyncHandler(RoleController.deleteRole)
);

module.exports = router;
