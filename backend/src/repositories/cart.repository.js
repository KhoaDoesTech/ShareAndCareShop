const BaseRepository = require('./base.repository');
const Cart = require('../models/cart.model');
const { getVariantImagesFromTierIndex } = require('../utils/helpers');

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
        select: 'prd_name prd_price prd_original_price prd_variants prd_images',
      })
      .lean();

    if (!cart) return null;

    return this.formatDocument(cart);
  }

  formatDocument(cart) {
    if (!cart) return null;

    return {
      id: cart._id,
      userId: cart.crt_user_id,
      items: cart.crt_items.map((item) => {
        return {
          productId: item.prd_id?._id || item.prd_id,
          productName: item.prd_id?.prd_name,
          price: item.prd_id?.prd_price,
          originalPrice: item.prd_id?.prd_original_price,
          productImage: item.prd_id?.prd_main_image,
          category: item.prd_id?.prd_category,
          variantId: item.var_id || null,
          variantImages, // Hình ảnh từ tierIndex
          quantity: item.prd_quantity,
        };
      }),
      status: cart.crt_status,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }
}

module.exports = CartRepository;
