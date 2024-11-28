const orderModels = require('../models/order.models');
const BaseRepository = require('./base.repository');

class OrderRepository extends BaseRepository {
  constructor() {
    super(orderModels);
    this.model = orderModels;
  }

  formatDocument(order) {
    if (!order) return null;

    return {
      id: order._id,
      userId: order.ord_user_id,
      couponId: order.ord_coupon_id,
      items: order.ord_items.map((item) => ({
        productId: item.prd_id,
        variantId: item.var_id,
        productName: item.prd_name,
        variantSlug: item.var_slug,
        productPrice: item.prd_price,
        productImage: item.prd_img,
        productQuantity: item.prd_quantity,
      })),
      shippingAddress: {
        fullname: order.ord_shipping_address.shp_fullname,
        phone: order.ord_shipping_address.shp_phone,
        city: order.ord_shipping_address.shp_city,
        district: order.ord_shipping_address.shp_district,
        ward: order.ord_shipping_address.shp_ward,
        street: order.ord_shipping_address.shp_street,
      },
      paymentMethod: order.ord_payment_method,
      deliveryMethod: order.ord_delivery_method,
      itemsPrice: order.ord_items_price,
      discountPrice: order.ord_discount_price,
      shippingPrice: order.ord_shipping_price,
      totalPrice: order.ord_total_price,
      isPaid: order.ord_is_paid,
      isDelivered: order.ord_is_delivered,
      paidAt: order.ord_paid_at,
      deliveredAt: order.ord_delivered_at,
      status: order.ord_status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}

module.exports = OrderRepository;
