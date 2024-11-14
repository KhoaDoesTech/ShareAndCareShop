'use strict';

const { model, Schema } = require('mongoose');
const {
  AvailableSocialLogins,
  UserLoginType,
  UserStatus,
  AvailableUserStatus,
} = require('../constants/status');
const SERVER_CONFIG = require('../configs/server.config');

const DOCUMENT_NAME = 'User';
const COLLECTION_NAME = 'Users';

const userSchema = new Schema(
  {
    usr_avatar: {
      type: String,
      default: SERVER_CONFIG.img.avatar,
    },
    usr_name: { type: String, required: true },
    usr_email: { type: String, required: true },
    usr_password: { type: String },
    usr_role: { type: Schema.Types.ObjectId, ref: 'Role' },
    usr_login_type: {
      type: String,
      enum: AvailableSocialLogins,
      default: UserLoginType.EMAIL_PASSWORD,
    },
    usr_status: {
      type: String,
      enum: AvailableUserStatus,
      default: UserStatus.PENDING,
    },
    public_key: { type: String, default: null },
    refresh_token: { type: String, default: null },
    refresh_tokens_used: { type: [String], default: [] },
    forgot_password_token: { type: String, default: null },
    forgot_password_expiry: { type: Date, default: null },
    verification_token: { type: String, default: null },
    verification_expiry: { type: Date, default: null },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

module.exports = model(DOCUMENT_NAME, userSchema);
