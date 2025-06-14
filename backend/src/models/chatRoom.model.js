'use strict';

const { model, Schema } = require('mongoose');

const DOCUMENT_NAME = 'ChatRoom';
const COLLECTION_NAME = 'ChatRooms';

const chatRoomSchema = new Schema(
  {
    room_device_token: { type: String },
    room_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    room_supporters: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    room_admin_support_requested: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  }
);

module.exports = model(DOCUMENT_NAME, chatRoomSchema);
