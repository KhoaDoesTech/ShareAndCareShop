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
      room_device_token: room.room_device_token,
      room_user_id: room.room_user_id,
      created_at: room.created_at,
      updated_at: room.updated_at,
    };
  }
}

module.exports = ChatRoomRepository;
