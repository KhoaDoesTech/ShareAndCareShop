const CartService = require('../services/cart.service');
const { CreateSuccess, NoContentSuccess } = require('../utils/successResponse');

class CartController {
  constructor() {
    this.cartService = new CartService();
  }

  addToCart = async (req, res, next) => {
    new CreateSuccess({
      message: 'Item added to cart successfully',
      metadata: await this.cartService.addToCart({
        user: req.user,
        ...req.body,
      }),
    }).send(res);
  };

  updateCartItems = async (req, res, next) => {
    new CreateSuccess({
      message: 'Cart updated successfully',
      metadata: await this.cartService.updateCartItems({
        user: req.user,
        ...req.body,
      }),
    }).send(res);
  };
}

module.exports = new CartController();
