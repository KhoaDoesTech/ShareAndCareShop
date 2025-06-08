const ChatService = require('../services/chat.service');
const logger = require('../helpers/logger.helper');

class ChatController {
  constructor() {
    this.chatService = new ChatService();
  }

  async postMessage(req, res, next) {
    try {
      const { deviceToken, userId, adminId, role, content, imageUrls, useAI } =
        req.body;
      const result = await this.chatService.postMessage({
        deviceToken,
        userId,
        adminId,
        role,
        content,
        imageUrls,
        useAI,
        senderType: adminId ? 'admin' : 'user',
      });
      res.json(result);
    } catch (error) {
      logger.error('Post message error:', error);
      next(error);
    }
  }

  async getConversation(req, res, next) {
    try {
      const { conversationId } = req.params;
      const result = await this.chatService.getConversation(conversationId);
      res.json(result);
    } catch (error) {
      logger.error('Get conversation error:', error);
      next(error);
    }
  }

  async getConversationsBySender(req, res, next) {
    try {
      const { deviceToken, userId } = req.query;
      const result = await this.chatService.getConversationBySender({
        deviceToken,
        userId,
      });
      res.json(result);
    } catch (error) {
      logger.error('Get conversations by sender error:', error);
      next(error);
    }
  }

  async mergeAnonymousChat(req, res, next) {
    try {
      const { deviceToken, userId } = req.body;
      const result = await this.chatService.mergeAnonymousChatToUser({
        deviceToken,
        userId,
      });
      res.json(result);
    } catch (error) {
      logger.error('Merge anonymous chat error:', error);
      next(error);
    }
  }

  async linkDeviceToUser(req, res, next) {
    try {
      const { deviceToken, userId } = req.body;
      const result = await this.chatService.mergeAnonymousChatToUser({
        deviceToken,
        userId,
      });
      res.json(result);
    } catch (error) {
      logger.error('Link device to user error:', error);
      next(error);
    }
  }

  async markMessagesAsSeen(req, res, next) {
    try {
      const { conversationId, userId, deviceToken } = req.body;
      const result = await this.chatService.markMessagesAsSeen({
        conversationId,
        userId,
        deviceToken,
      });
      res.json(result);
    } catch (error) {
      logger.error('Mark messages as seen error:', error);
      next(error);
    }
  }

  async deleteConversation(req, res, next) {
    try {
      const { conversationId } = req.params;
      const { userId, deviceToken } = req.body;
      const result = await this.chatService.deleteConversation({
        conversationId,
        userId,
        deviceToken,
      });
      res.json(result);
    } catch (error) {
      logger.error('Delete conversation error:', error);
      next(error);
    }
  }

  async getUnseenMessageCount(req, res, next) {
    try {
      const { userId, deviceToken } = req.query;
      const result = await this.chatService.getUnseenMessageCount({
        userId,
        deviceToken,
      });
      res.json(result);
    } catch (error) {
      logger.error('Get unseen message count error:', error);
      next(error);
    }
  }

  async takeOverConversation(req, res, next) {
    try {
      const { conversationId, adminId } = req.body;
      const result = await this.chatService.takeOverConversation({
        conversationId,
        adminId,
      });
      res.json(result);
    } catch (error) {
      logger.error('Take over conversation error:', error);
      next(error);
    }
  }

  async releaseConversation(req, res, next) {
    try {
      const { conversationId, adminId } = req.body;
      const result = await this.chatService.releaseConversation({
        conversationId,
        adminId,
      });
      res.json(result);
    } catch (error) {
      logger.error('Release conversation error:', error);
      next(error);
    }
  }

  async getStatus(req, res) {
    const chatSocketHandler = req.app.get('chatSocketHandler');
    const stats = chatSocketHandler
      ? chatSocketHandler.getConnectedUsersCount()
      : { authenticated: 0, anonymous: 0, admins: 0, total: 0 };

    res.json({
      status: 'online',
      connectedUsers: stats,
      timestamp: new Date(),
    });
  }
}

module.exports = new ChatController();
