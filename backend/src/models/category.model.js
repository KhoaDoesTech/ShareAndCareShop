'use strict';

const { model, Schema } = require('mongoose');

const DOCUMENT_NAME = 'Category';
const COLLECTION_NAME = 'Categories';

const categorySchema = new Schema(
  {
    cat_name: { type: String, default: 'text' },
    cat_left: { type: Number, default: 0 },
    cat_right: { type: Number, default: 0 },
    cat_parent_id: { type: Schema.Types.ObjectId, ref: DOCUMENT_NAME },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  }
);

module.exports = model(DOCUMENT_NAME, categorySchema);
