'use strict';

const express = require('express');
const router = express.Router();

router.use('/api/v1/auth', require('./auth'));
router.use('/api/v1/users', require('./user'));
router.use('/api/v1/products', require('./product'));
router.use('/api/v1/uploads', require('./upload'));
router.use('/api/v1/categories', require('./category'));
// router.use('/api/v1/payment', require('./payment'));

module.exports = router;
