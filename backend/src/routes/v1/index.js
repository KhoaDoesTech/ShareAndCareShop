'use strict';

const express = require('express');
const router = express.Router();

router.use('/api/v1/auth', require('./auth'));
router.use('/api/v1/token', require('./token'));
router.use('/api/v1/users', require('./user'));
router.use('/api/v1/products', require('./product'));
router.use('/api/v1/uploads', require('./upload'));
router.use('/api/v1/categories', require('./category'));
router.use('/api/v1/cart', require('./cart'));
router.use('/api/v1/variants', require('./variant'));
router.use('/api/v1/payment', require('./payment'));
router.use('/api/v1/address', require('./address'));
router.use('/api/v1/order', require('./order'));
router.use('/api/v1/coupon', require('./coupon'));
router.use('/api/v1/delivery', require('./delivery'));
router.use('/api/v1/role', require('./role'));
router.use('/api/v1/statistics', require('./statistics'));
router.use('/api/v1/review', require('./review'));

module.exports = router;
