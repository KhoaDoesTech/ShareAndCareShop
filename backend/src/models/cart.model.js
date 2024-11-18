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
          prd_id: { type: Schema.Types.ObjectId, ref: 'Product' },
          var_id: { type: Schema.Types.ObjectId, ref: 'Variant' },
          prd_quantity: { type: Number, required: true },
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
