'use strict';

const { model, Schema } = require('mongoose');

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
    msg_user_id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    msg_sender_type: {
      type: String,
      enum: ['user', 'admin', 'assistant', 'system'],
      default: 'user',
    },
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
