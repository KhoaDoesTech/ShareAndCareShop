'use strict';

const { model, Schema } = require('mongoose');

const DOCUMENT_NAME = 'Comment';
const COLLECTION_NAME = 'Comments';

const commentSchema = new Schema(
  {
    cmt_product_id: { type: Schema.Types.ObjectId, ref: 'Product' },
    cmt_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    cmt_content: { type: String, default: 'text' },
    cmt_left: { type: Number, default: 0 },
    cmt_right: { type: Number, default: 0 },
    cmt_parent_id: { type: Schema.Types.ObjectId, ref: DOCUMENT_NAME },
    cmt_is_deleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: COLLECTION_NAME,
  }
);

module.exports = model(DOCUMENT_NAME, commentSchema);
