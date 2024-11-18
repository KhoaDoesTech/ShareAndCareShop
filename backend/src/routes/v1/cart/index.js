'use strict';

const express = require('express');
const upload = require('../../../middlewares/multer.middleware');

const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');
const asyncHandler = require('../../../middlewares/async.middleware');
const CartController = require('../../../controllers/cart.controller');
const router = express.Router();

router.post('/', authentication, asyncHandler(CartController.addToCart));
router.patch('/', authentication, asyncHandler(CartController.updateCartItems));
module.exports = router;
