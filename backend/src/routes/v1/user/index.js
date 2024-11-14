'use strict';

const express = require('express');
const validate = require('../../../middlewares/validate.middleware');
const asyncHandler = require('../../../middlewares/async.middleware');
const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');

const AuthController = require('../../../controllers/auth.controller');
const {
  userRegisterValidator,
  userLoginValidator,
} = require('../../../validators/auth.validator');

const router = express.Router();
const authController = new AuthController();

router.post('/');

module.exports = router;
