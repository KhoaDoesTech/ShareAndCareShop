'use strict';

const chatRoomModels = require('../models/chatRoom.model');
const BaseRepository = require('./base.repository');

class ChatRoomRepository extends BaseRepository {
  constructor() {
    super(chatRoomModels);
    this.model = chatRoomModels;
  }

  formatDocument(room) {
    if (!room) return null;
    return {
      id: room._id,
      deviceToken: room.room_device_token,
      userId: room.room_user_id,
      createdAt: room.created_at,
      updatedAt: room.updated_at,
    };
  }
}

module.exports = ChatRoomRepository;
