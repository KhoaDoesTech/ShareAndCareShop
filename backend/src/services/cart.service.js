const CartRepository = require('../repositories/cart.repository');
const { BadRequestError } = require('../utils/errorResponse');

class CartService {
  constructor() {
    this.cartRepository = new CartRepository();
  }

  async updateCartItems({ user, productId, variantId, quantity }) {
    const foundCart = await this.cartRepository.getByQuery({
      crt_user_id: user.id,
    });

    if (!foundCart) throw new BadRequestError('Cart not found');

    const relatedItems = foundCart.items.filter(
      (item) => item.productId.toString() === productId.toString()
    );

    const newVariantIndex = relatedItems.findIndex(
      (item) => item.variantId?.toString() === variantId?.toString()
    );

    if (quantity === 0) {
      if (newVariantIndex > -1) {
        const itemIndex = foundCart.items.indexOf(
          relatedItems[newVariantIndex]
        );
        if (itemIndex > -1) foundCart.items.splice(itemIndex, 1);
      }
    } else if (newVariantIndex > -1) {
      foundCart.items[newVariantIndex].quantity = quantity;
    } else {
      foundCart.items.push({
        productId,
        variantId,
        quantity,
      });
    }

    await this.cartRepository.updateById(foundCart.id, {
      crt_items: foundCart.items.map((item) => ({
        prd_id: item.productId,
        var_id: item.variantId,
        prd_quantity: item.quantity,
      })),
    });

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

  async removeCartItem({ user, productId, variantId }) {
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

    if (itemIndex === -1) throw new BadRequestError('Item not found in cart');

    foundCart.items.splice(itemIndex, 1);

    await this.cartRepository.updateById(foundCart.id, {
      crt_items: foundCart.items.map((item) => ({
        prd_id: item.productId,
        var_id: item.variantId,
        prd_quantity: item.quantity,
      })),
    });

    return foundCart;
  }

  async clearCart(user) {
    const foundCart = await this.cartRepository.getByQuery({
      crt_user_id: user.id,
    });

    if (!foundCart) throw new BadRequestError('Cart not found');

    foundCart.items = [];

    await this.cartRepository.updateById(foundCart.id, { crt_items: [] });

    return foundCart;
  }

  async getCart(user) {
    const foundCart = await this.cartRepository.getCartWithDetails(user.id);

    return foundCart;
  }
}

module.exports = CartService;
