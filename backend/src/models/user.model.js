'use strict';

const { model, Schema } = require('mongoose');
const {
  AvailableSocialLogins,
  UserLoginType,
  UserStatus,
  AvailableUserStatus,
} = require('../constants/status');
const SERVER_CONFIG = require('../configs/server.config');
const cartModel = require('./cart.model');

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
    usr_phone: { type: String, default: '' },
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
    failed_login_attempts: { type: Number, default: 0 },
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

userSchema.pre('save', async function (next) {
  if (this.isNew) {
    const cart = await cartModel.findOne({ crt_user_id: this._id });

    if (!cart) {
      await cartModel.create({
        crt_user_id: this._id,
      });
    }
  }
  next();
});

userSchema.index({
  usr_name: 'text',
  usr_email: 'text',
  usr_phone: 'text',
});

module.exports = model(DOCUMENT_NAME, userSchema);
