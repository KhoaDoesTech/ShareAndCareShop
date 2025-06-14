'use strict';

const ChatService = require('../services/chat.service');
const { ActionSuccess, CreateSuccess } = require('../utils/successResponse');

class ChatController {
  constructor() {
    this.chatService = new ChatService();
    this.chatService.init();
  }

  postMessageByUser = async (req, res, next) => {
    new CreateSuccess({
      message: 'Message posted successfully',
      metadata: await this.chatService.postMessageByUser({
        ...req.body,
        user: req.user,
        conversationId: req.params.conversationId,
      }),
    }).send(res);
  };

  postMessageByAnonymous = async (req, res, next) => {
    new CreateSuccess({
      message: 'Message posted successfully',
      metadata: await this.chatService.postMessageByAnonymous(req.body),
    }).send(res);
  };

  getAllConversationsByUser = async (req, res, next) => {
    new ActionSuccess({
      message: 'Conversation retrieved successfully',
      metadata: await this.chatService.getAllConversationsByUser({
        userId: req.user.id,
        ...req.query,
      }),
    }).send(res);
  };

  getAllConversationsByAdmin = async (req, res, next) => {
    new ActionSuccess({
      message: 'Conversation retrieved successfully',
      metadata: await this.chatService.getAllConversationsByAdmin({
        userId: req.user.id,
        ...req.query,
      }),
    }).send(res);
  };

  getMessageByConversationId = async (req, res, next) => {
    new ActionSuccess({
      message: 'Messages retrieved successfully',
      metadata: await this.chatService.getMessageByConversationId({
        conversationId: req.params.conversationId,
        userId: req.user.id,
        ...req.query,
      }),
    }).send(res);
  };

  mergeAnonymousChatToUser = async (req, res, next) => {
    new ActionSuccess({
      message: 'Anonymous chat merged successfully',
      metadata: await this.chatService.mergeAnonymousChatToUser({
        user: req.user,
        deviceToken: req.body.deviceToken,
      }),
    }).send(res);
  };

  markMessageAsSeen = async (req, res, next) => {
    new ActionSuccess({
      message: 'Messages seen status updated successfully',
      metadata: await this.chatService.markMessageAsSeen({
        conversationId: req.params.conversationId,
        userId: req.user.id,
      }),
    }).send(res);
  };

  syncQdrant = async (req, res, next) => {
    new ActionSuccess({
      message: 'Qdrant sync completed successfully',
      metadata: await this.chatService.textToNoSQL(),
    }).send(res);
  };
}

module.exports = new ChatController();
