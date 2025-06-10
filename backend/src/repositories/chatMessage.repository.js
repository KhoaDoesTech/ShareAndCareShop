'use strict';

const chatMessageModels = require('../models/chatMessage.model');
const BaseRepository = require('./base.repository');

class ChatMessageRepository extends BaseRepository {
  constructor() {
    super(chatMessageModels);
    this.model = chatMessageModels;
  }

  async getLastestMessageByConversationId(conversationId) {
    const message = await this.model
      .findOne({ msg_conversation_id: conversationId })
      .sort({ createdAt: -1 })
      .populate('msg_user_id', 'usr_name usr_avatar')
      .lean();

    return this.formatDocument(message);
  }

  async updateMany(filter, update) {
    return this.model.updateMany(filter, update);
  }

  formatDocument(message) {
    if (!message) return null;

    return {
      id: message._id,
      conversationId: message.msg_conversation_id,
      sender: message.msg_sender,
      userId: message.msg_user_id
        ? {
            id: message.msg_user_id._id,
            name: message.msg_user_id.usr_name,
            avatar: message.msg_user_id.usr_avatar,
          }
        : null,
      senderType: message.msg_sender_type,
      content: message.msg_content,
      image: message.msg_image,
      seen: message.msg_seen,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }
}

module.exports = ChatMessageRepository;
