const CartService = require('../services/cart.service');
const {
  CreateSuccess,
  NoContentSuccess,
  ActionSuccess,
} = require('../utils/successResponse');

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
    new ActionSuccess({
      message: 'Cart updated successfully',
      metadata: await this.cartService.updateCartItems({
        user: req.user,
        ...req.body,
      }),
    }).send(res);
  };

  removeItemFromCart = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Item removed from cart successfully',
      metadata: await this.cartService.removeCartItem({
        user: req.user,
        ...req.body,
      }),
    }).send(res);
  };

  clearCart = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Cart cleared successfully',
      metadata: await this.cartService.clearCart(req.user),
    }).send(res);
  };

  getCart = async (req, res, next) => {
    new ActionSuccess({
      message: 'Cart retrieved successfully',
      metadata: await this.cartService.getCart(req.user),
    }).send(res);
  };
}

module.exports = new CartController();
