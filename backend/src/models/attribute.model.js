'use strict';

const { model, Schema } = require('mongoose');
const {
  AttributeType,
  AvailableAttributeTypes,
} = require('../constants/status');
const slugify = require('slugify');

const DOCUMENT_NAME = 'Attribute';
const COLLECTION_NAME = 'Attributes';

const attributeSchema = new Schema(
  {
    attr_name: { type: String, required: true, unique: true },
    attr_slug: { type: String, unique: true, trim: true },
    attr_type: {
      type: String,
      enum: AvailableAttributeTypes,
      default: AttributeType.TEXT,
    },
    attr_values: [
      {
        type: Schema.Types.ObjectId,
        ref: 'AttributeValue',
      },
    ],
    attr_is_variant: { type: Boolean, default: false },
    attr_is_active: { type: Boolean, required: true, default: true },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  }
);

attributeSchema.pre('save', async function (next) {
  if (!this.isModified('attr_name')) return next();

  this.attr_slug = slugify(this.attr_name, { lower: true, strict: true });
  next();
});

module.exports = model(DOCUMENT_NAME, attributeSchema);
