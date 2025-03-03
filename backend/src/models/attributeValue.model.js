'use strict';

const { model, Schema } = require('mongoose');
const {
  AttributeType,
  AvailableAttributeTypes,
} = require('../constants/status');

const DOCUMENT_NAME = 'AttributeValue';
const COLLECTION_NAME = 'AttributeValues';

const attributeValueSchema = new Schema(
  {
    attr_id: {
      type: Schema.Types.ObjectId,
      ref: 'Attribute',
      required: true,
    },
    value: { type: String, required: true, trim: true },
    description_url: { type: String, trim: true },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  }
);

module.exports = model(DOCUMENT_NAME, attributeValueSchema);
