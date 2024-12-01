'use strict';

const { model, Schema } = require('mongoose');
const { AddressType, AvailableAddressTypes } = require('../constants/status');

const DOCUMENT_NAME = 'Address';
const COLLECTION_NAME = 'Addresses';

const addressSchema = new Schema(
  {
    usr_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    usr_name: { type: String },
    usr_phone: { type: String, default: '' },
    adr_place_id: { type: String, required: true },
    adr_street: { type: String, required: true },
    adr_ward: { type: String, required: true },
    adr_district: { type: String, required: true },
    adr_city: { type: String, required: true },
    adr_location: {
      type: {
        lat: { type: Number },
        lng: { type: Number },
      },
      required: true,
    },
    adr_type: {
      type: String,
      enum: AvailableAddressTypes,
      default: AddressType.NONE,
    },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

module.exports = model(DOCUMENT_NAME, addressSchema);
