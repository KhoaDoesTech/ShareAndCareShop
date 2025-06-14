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
      message: 'Gửi tin nhắn thành công',
      metadata: await this.chatService.postMessageByUser({
        ...req.body,
        user: req.user,
        conversationId: req.params.conversationId,
      }),
    }).send(res);
  };

  postMessageByAnonymous = async (req, res, next) => {
    new CreateSuccess({
      message: 'Gửi tin nhắn thành công',
      metadata: await this.chatService.postMessageByAnonymous(req.body),
    }).send(res);
  };

  getAllConversationsByUser = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy hội thoại thành công',
      metadata: await this.chatService.getAllConversationsByUser({
        userId: req.user.id,
        ...req.query,
      }),
    }).send(res);
  };

  getAllConversationsByAdmin = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy hội thoại thành công',
      metadata: await this.chatService.getAllConversationsByAdmin({
        userId: req.user.id,
        ...req.query,
      }),
    }).send(res);
  };

  getMessageByConversationId = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy tin nhắn thành công',
      metadata: await this.chatService.getMessageByConversationId({
        conversationId: req.params.conversationId,
        userId: req.user.id,
        ...req.query,
      }),
    }).send(res);
  };

  mergeAnonymousChatToUser = async (req, res, next) => {
    new ActionSuccess({
      message: 'Gộp hội thoại ẩn danh thành công',
      metadata: await this.chatService.mergeAnonymousChatToUser({
        user: req.user,
        deviceToken: req.body.deviceToken,
      }),
    }).send(res);
  };

  markMessageAsSeen = async (req, res, next) => {
    new ActionSuccess({
      message: 'Cập nhật trạng thái đã xem tin nhắn thành công',
      metadata: await this.chatService.markMessageAsSeen({
        conversationId: req.params.conversationId,
        userId: req.user.id,
      }),
    }).send(res);
  };

  syncQdrant = async (req, res, next) => {
    new ActionSuccess({
      message: 'Đồng bộ Qdrant thành công',
      metadata: await this.chatService.textToNoSQL(),
    }).send(res);
  };
}

module.exports = new ChatController();
