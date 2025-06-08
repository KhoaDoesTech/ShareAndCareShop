const express = require('express');
const router = express.Router();
const chatController = require('../../../controllers/chat.controller');

router.post('/message', chatController.postMessage.bind(chatController));

router.get(
  '/conversation/:conversationId',
  chatController.getConversation.bind(chatController)
);

router.get(
  '/conversations',
  chatController.getConversationsBySender.bind(chatController)
);

router.post('/merge', chatController.mergeAnonymousChat.bind(chatController));

router.post(
  '/link-device',
  chatController.linkDeviceToUser.bind(chatController)
);

router.post(
  '/mark-seen',
  chatController.markMessagesAsSeen.bind(chatController)
);

router.delete(
  '/conversation/:conversationId',
  chatController.deleteConversation.bind(chatController)
);

router.get(
  '/unseen-count',
  chatController.getUnseenMessageCount.bind(chatController)
);

router.post(
  '/take-over',
  chatController.takeOverConversation.bind(chatController)
);

router.post(
  '/release',
  chatController.releaseConversation.bind(chatController)
);

router.get('/status', chatController.getStatus.bind(chatController));

module.exports = router;
