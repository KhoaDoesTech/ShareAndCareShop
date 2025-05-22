// src/controllers/chat.controller.js
'use strict';

const ChatService = require('../services/chat.service');
const { ActionSuccess, CreateSuccess } = require('../utils/successResponse');

class ChatController {
  constructor() {
    this.chatService = new ChatService();
  }

  postMessage = async (req, res, next) => {
    new CreateSuccess({
      message: 'Message sent',
      metadata: await this.chatService.postMessage(req.body),
    }).send(res);
  };

  // GET /v1/chats/:conversationId
  getConversation = async (req, res, next) => {
    const conversationId = req.params.conversationId;
    const chats = await this.chatService.getConversation(conversationId);
    new ActionSuccess({
      message: 'Conversation fetched',
      metadata: chats,
    }).send(res);
  };

  // GET /v1/chats/me/:idSender
  getConversationBySender = async (req, res, next) => {
    const idSender = req.params.idSender;
    console.log(req.params);
    const chats = await this.chatService.getConversationBySender(req.body);
    new ActionSuccess({
      message: 'Conversation fetched',
      metadata: chats,
    }).send(res);
  };
}

module.exports = new ChatController();
