'use strict';

const { model, Schema } = require('mongoose');
const { AvailableChatRoles } = require('../constants/status');

const DOCUMENT_NAME = 'ChatMessage';
const COLLECTION_NAME = 'ChatMessages';

const chatMessageSchema = new Schema(
  {
    msg_conversation_id: {
      type: Schema.Types.ObjectId,
      ref: 'ChatRoom',
      required: true,
    },
    msg_sender: { type: String },
    msg_role: { type: String, enum: AvailableChatRoles, required: true },
    msg_content: { type: String },
    msg_image: { type: String },
    msg_seen: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  }
);

module.exports = model(DOCUMENT_NAME, chatMessageSchema);
