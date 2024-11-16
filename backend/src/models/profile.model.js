'use strict';

const { model, Schema } = require('mongoose');
const { AddressType, AvailableAddressTypes } = require('../constants/status');

const DOCUMENT_NAME = 'Profile';
const COLLECTION_NAME = 'Profiles';

const addressSchema = new Schema(
  {
    adr_street: { type: String },
    adr_ward: { type: String },
    adr_district: { type: String },
    adr_city: { type: String },
    adr_country: { type: String },
    adr_type: {
      type: String,
      enum: AvailableAddressTypes,
      default: AddressType.NONE,
    },
  },
  { _id: false }
);

const profileSchema = new Schema(
  {
    usr_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    prof_name: { type: String },
    prof_phone: { type: String },
    prof_address: { type: [addressSchema], default: [] },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

module.exports = model(DOCUMENT_NAME, profileSchema);
