const BaseRepository = require('./base.repository');
const Cart = require('../models/cart.model');

class CartRepository extends BaseRepository {
  constructor() {
    super(Cart);
    this.model = Cart;
  }

  formatDocument(cart) {
    if (!cart) return null;
    return {
      id: cart._id,
      userId: cart.crt_user_id,
      items: cart.crt_items.map((item) => ({
        productId: item.prd_id,
        variantId: item.var_id,
        quantity: item.prd_quantity,
      })),
      status: cart.crt_status,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }
}

module.exports = CartRepository;
