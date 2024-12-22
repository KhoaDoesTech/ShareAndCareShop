'use strict';

const express = require('express');
const ReviewController = require('../../../controllers/review.controller');
const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');

const router = express.Router();

router.get('/can-review', authentication, ReviewController.getProductCanReview);

router.post('/', authentication, ReviewController.createReview);
router.post('/reply', authentication, ReviewController.replyReview);

module.exports = router;
