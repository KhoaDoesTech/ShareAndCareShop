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
      message: 'Thêm sản phẩm vào giỏ hàng thành công',
      metadata: await this.cartService.addToCart({
        user: req.user,
        ...req.body,
      }),
    }).send(res);
  };

  updateCartItems = async (req, res, next) => {
    new ActionSuccess({
      message: 'Cập nhật giỏ hàng thành công',
      metadata: await this.cartService.updateCartItems({
        user: req.user,
        ...req.body,
      }),
    }).send(res);
  };

  removeItemFromCart = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Xóa sản phẩm khỏi giỏ hàng thành công',
      metadata: await this.cartService.removeCartItem({
        user: req.user,
        ...req.body,
      }),
    }).send(res);
  };

  clearCart = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Xóa toàn bộ giỏ hàng thành công',
      metadata: await this.cartService.clearCart(req.user),
    }).send(res);
  };

  getCart = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy giỏ hàng thành công',
      metadata: await this.cartService.getCart(req.user),
    }).send(res);
  };
}

module.exports = new CartController();
