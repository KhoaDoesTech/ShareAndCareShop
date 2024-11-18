const BaseRepository = require('./base.repository');
const Cart = require('../models/cart.model');
const {
  getVariantImagesFromTierIndex,
  getVariantImageOrDefault,
} = require('../utils/helpers');

class CartRepository extends BaseRepository {
  constructor() {
    super(Cart);
    this.model = Cart;
  }

  async getCartWithDetails(userId) {
    const cart = await this.model
      .findOne({ crt_user_id: userId })
      .populate({
        path: 'crt_items.prd_id',
        select:
          'prd_name prd_price prd_original_price prd_variants prd_images prd_main_image',
      })
      .populate({
        path: 'crt_items.var_id',
        select: 'var_slug var_price var_tier_idx',
      })
      .lean();

    if (!cart) return null;

    const items = cart.crt_items.map((item) => {
      const product = item.prd_id;

      const image = getVariantImageOrDefault(
        product?.prd_variants,
        item.var_id?.var_tier_idx,
        product?.prd_main_image
      );

      const price = item.var_id?.var_price || product?.prd_price;
      const itemTotalPrice = price * item.prd_quantity;
      const itemTotalOriginalPrice =
        product?.prd_original_price * item.prd_quantity;

      return {
        productId: product?._id || item.prd_id,
        variantId: item.var_id?._id,
        productName: product?.prd_name,
        variantSlug: item.var_id?.var_slug,
        quantity: item.prd_quantity,
        price,
        originalPrice: product?.prd_original_price,
        itemTotalPrice,
        itemTotalOriginalPrice,
        productImage: image,
        variants: product?.prd_variants.map((variant) => ({
          name: variant.var_name,
          options: variant.var_options,
        })),
      };
    });

    return {
      id: cart._id,
      userId: cart.crt_user_id,
      items: items,
    };
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
    };
  }
}

module.exports = CartRepository;
