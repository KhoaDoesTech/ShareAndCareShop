const { model, Schema } = require('mongoose');
const { AvailableCartStatus, CartStatus } = require('../constants/status');

const DOCUMENT_NAME = 'Cart';
const COLLECTION_NAME = 'Carts';

const cartSchema = new Schema(
  {
    crt_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    crt_items: {
      type: [
        {
          product_id: { type: Schema.Types.ObjectId, ref: 'Product' },
          variant_id: { type: Schema.Types.ObjectId, ref: 'Variant' },
          quantity: { type: Number, required: true, default: 1 },
        },
      ],
      default: [],
    },
    crt_status: {
      type: String,
      require: true,
      enum: AvailableCartStatus,
      default: CartStatus.ACTIVE,
    },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: {
      createdAt: 'createdOn',
      updatedAt: 'modifiedOn',
    },
  }
);

module.exports = model(DOCUMENT_NAME, cartSchema);
