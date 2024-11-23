'use strict';

const { model, Schema } = require('mongoose');

const DOCUMENT_NAME = 'Token';
const COLLECTION_NAME = 'Tokens';

const tokenSchema = new Schema(
  {
    tkn_user: { type: Schema.Types.ObjectId, ref: 'User' },
    tkn_device_name: { type: String, required: true },
    tkn_device_token: { type: String, required: true },
    tkn_public_key: { type: String, required: true },
    tkn_refresh_token: { type: String, required: true },
    tkn_refresh_tokens_used: { type: [String], default: [] },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

module.exports = model(DOCUMENT_NAME, tokenSchema);
