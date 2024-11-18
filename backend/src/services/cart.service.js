const CartRepository = require('../repositories/cart.repository');
const { BadRequestError } = require('../utils/errorResponse');

class CartService {
  constructor() {
    this.cartRepository = new CartRepository();
  }

  async updateCartItems({ user, productId, variantId, quantity, oldQuantity }) {
    const foundCart = await this.cartRepository.getByQuery({
      crt_user_id: user.id,
    });

    if (!foundCart) throw new BadRequestError('Cart not found');

    const itemIndex = foundCart.items.findIndex(
      (item) =>
        item.productId.toString() === productId.toString() &&
        (!item.variantId ||
          item.variantId?.toString() === variantId?.toString())
    );

    if (itemIndex > -1) {
      const newQuantity =
        foundCart.items[itemIndex].quantity + (quantity - oldQuantity);

      if (newQuantity <= 0) {
        foundCart.items.splice(itemIndex, 1);
      } else {
        foundCart.items[itemIndex].quantity = newQuantity;
      }

      await this.cartRepository.updateById(foundCart.id, {
        crt_items: foundCart.items.map((item) => ({
          prd_id: item.productId,
          var_id: item.variantId,
          prd_quantity: item.quantity,
        })),
      });
    }

    return foundCart;
  }

  async addToCart({ user, productId, variantId, quantity }) {
    const foundCart = await this.cartRepository.getByQuery({
      crt_user_id: user.id,
    });

    if (!foundCart) {
      const newCart = await this.cartRepository.create({
        crt_user_id: user.id,
        crt_items: {
          prd_id: productId,
          var_id: variantId,
          prd_quantity: quantity,
        },
      });

      return newCart;
    }

    const itemIndex = foundCart.items.findIndex(
      (item) =>
        item.productId.toString() === productId.toString() &&
        (!item.variantId ||
          item.variantId?.toString() === variantId?.toString())
    );

    if (itemIndex > -1) {
      foundCart.items[itemIndex].quantity += quantity;
    } else {
      foundCart.items.push({ productId, variantId, quantity });
    }

    const newCart = await this.cartRepository.updateById(foundCart.id, {
      crt_items: foundCart.items.map((item) => ({
        prd_id: item.productId,
        var_id: item.variantId,
        prd_quantity: item.quantity,
      })),
    });

    return newCart;
  }
}

module.exports = CartService;
