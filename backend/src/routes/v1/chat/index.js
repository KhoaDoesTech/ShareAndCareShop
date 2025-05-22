// src/routes/v1/chat.routes.js
'use strict';

const express = require('express');
const router = express.Router();
const asyncHandler = require('../../../middlewares/async.middleware');
const { authentication } = require('../../../middlewares/auth.middleware');
const ChatController = require('../../../controllers/chat.controller');
const upload = require('../../../middlewares/multer.middleware');

// Gửi message, có thể kèm useAI=true để gọi ChatGPT
router.post('/message', asyncHandler(ChatController.postMessage));

// Lấy toàn bộ conversation
router.get(
  '/conversation/:conversationId',
  asyncHandler(ChatController.getConversation)
);

router.get('/me', asyncHandler(ChatController.getConversationBySender));

module.exports = router;
