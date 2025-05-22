// src/routes/v1/blog.routes.js
'use strict';

const express = require('express');
const asyncHandler = require('../../../middlewares/async.middleware');
const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');
const BlogController = require('../../../controllers/blog.controller');

const router = express.Router();

// POST   /v1/blogs        — tạo mới
router.post('/', authentication, asyncHandler(BlogController.create));

// GET    /v1/blogs        — lấy danh sách
router.get('/', authentication, asyncHandler(BlogController.findAll));

// GET    /v1/blogs/:blogId — lấy chi tiết
router.get('/:blogId', authentication, asyncHandler(BlogController.findOne));

// PUT    /v1/blogs/:blogId — cập nhật
router.put('/:blogId', authentication, asyncHandler(BlogController.update));

// DELETE /v1/blogs/:blogId — xóa
router.delete('/:blogId', authentication, asyncHandler(BlogController.delete));

router.get(
  'type/:type',
  authentication,
  asyncHandler(BlogController.findAllByType)
);

router.get(
  'type/:type/:idUser',
  authentication,
  asyncHandler(BlogController.findAllByTypeExUser)
);

module.exports = router;
