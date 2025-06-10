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
      supporters: room.room_supporters,
      adminSupportRequested: room.room_admin_support_requested,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }
}

module.exports = ChatRoomRepository;
