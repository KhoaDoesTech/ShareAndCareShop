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
      msg_conversation_id: message.msg_conversation_id,
      msg_sender: message.msg_sender,
      msg_role: message.msg_role,
      msg_content: message.msg_content,
      msg_image: message.msg_image,
      msg_seen: message.msg_seen,
      created_at: message.created_at,
      updated_at: message.updated_at,
    };
  }
}

module.exports = ChatMessageRepository;
