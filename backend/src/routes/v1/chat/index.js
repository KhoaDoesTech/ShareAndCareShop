'use strict';

const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');
const ChatController = require('../../../controllers/chat.controller');
const express = require('express');
const asyncHandler = require('../../../middlewares/async.middleware');

// Initialize the router
const router = express.Router();

// Public (anonymous user)
router.post('/', asyncHandler(ChatController.postMessageByAnonymous));

// Authenticated user
router.use(authentication);

// User-specific conversations
router.get(
  '/conversations/me',
  asyncHandler(ChatController.getAllConversationsByUser)
);

// Messages within a conversation
router.post('/conversations', asyncHandler(ChatController.postMessageByUser));
router.put(
  '/conversations/:conversationId/seen',
  asyncHandler(ChatController.markMessageAsSeen)
);
router.get(
  '/conversations/:conversationId',
  asyncHandler(ChatController.getMessageByConversationId)
);

// Merge anonymous chat (user claiming old anonymous chat)
router.post('/merge', asyncHandler(ChatController.mergeAnonymousChatToUser));

// Admin: get all conversations (requires permission)
router.get(
  '/conversations',
  verifyPermission(CONFIG_PERMISSIONS.PAGE.PANEL),
  asyncHandler(ChatController.getAllConversationsByAdmin)
);

module.exports = router;
