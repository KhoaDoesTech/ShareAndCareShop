'use strict';

const express = require('express');
const ReviewController = require('../../../controllers/review.controller');
const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');
const asyncHandler = require('../../../middlewares/async.middleware');

const router = express.Router();

// Public: Get all reviews for a product
router.get(
  '/product/:productId',
  asyncHandler(ReviewController.getReviewsByProduct)
);

// Authenticated user routes
router.post('/', authentication, asyncHandler(ReviewController.createReview));
router.get(
  '/user',
  authentication,
  asyncHandler(ReviewController.getReviewsDetailsByUser)
);
router.post(
  '/:reviewId/report',
  authentication,
  asyncHandler(ReviewController.reportReview)
);

// Admin/staff-level routes
router.get(
  '/unreplied',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.REVIEW.VIEW),
  asyncHandler(ReviewController.getUnrepliedReviews)
);

router.get(
  '/:reviewId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.REVIEW.VIEW),
  asyncHandler(ReviewController.getReviewById)
);

router.post(
  '/:reviewId/reply',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.REVIEW.UPDATE),
  asyncHandler(ReviewController.replyReview)
);

router.put(
  '/:reviewId/hide',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.MANAGE_ORDER.REVIEW.UPDATE),
  asyncHandler(ReviewController.hideReview)
);

module.exports = router;
