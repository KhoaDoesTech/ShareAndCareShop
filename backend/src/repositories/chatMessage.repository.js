'use strict';

const chatMessageModels = require('../models/chatMessage.model');
const BaseRepository = require('./base.repository');

class ChatMessageRepository extends BaseRepository {
  constructor() {
    super(chatMessageModels);
    this.model = chatMessageModels;
  }

  formatDocument(message) {
    if (!message) return null;
    return {
      id: message._id,
      conversationId: message.msg_conversation_id,
      sender: message.msg_sender,
      role: message.msg_role,
      content: message.msg_content,
      image: message.msg_image,
      seen: message.msg_seen,
      createdAt: message.created_at,
      updatedAt: message.updated_at,
    };
  }
}

module.exports = ChatMessageRepository;
