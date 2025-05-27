const { OrderStatus } = require('../constants/status');
const orderModels = require('../models/order.model');
const APIFeatures = require('../utils/apiFeatures');
const { convertToObjectIdMongodb } = require('../utils/helpers');
const BaseRepository = require('./base.repository');

class OrderRepository extends BaseRepository {
  constructor() {
    super(orderModels);
    this.model = orderModels;
  }

  async getAllOrder({
    filter = {},
    queryOptions = {},
    populateOptions = null,
  }) {
    const features = new APIFeatures(
      this.model.find(filter).populate(populateOptions),
      queryOptions
    )
      .filter()
      .limitFields()
      .sort();

    const documents = await features.query;
    return documents.map(this.formatDocument.bind(this));
  }

  async totalProductsSold() {
    const result = await this.model.aggregate([
      {
        $match: {
          ord_status: OrderStatus.DELIVERED,
        },
      },
      { $unwind: '$ord_items' },
      {
        $group: {
          _id: null,
          totalQuantitySold: { $sum: '$ord_items.prd_quantity' },
        },
      },
    ]);

    const totalQuantity = result.length ? result[0].totalQuantitySold : 0;

    return totalQuantity;
  }

  formatDocument(order) {
    if (!order) return null;

    return {
      id: order._id,
      userId: order.ord_user_id,
      couponCode: order.ord_coupon_code,
      items: order.ord_items.map((item) => ({
        productId: item.prd_id,
        variantId: item.var_id,
        productName: item.prd_name,
        variantSlug: item.var_slug,
        image: item.prd_img,
        price: item.prd_price,
        quantity: item.prd_quantity,
        productDiscount: item.prd_discount,
        couponDiscount: item.prd_coupon_discount || 0,
        total:
          item.prd_price * item.prd_quantity -
          (item.prd_discount + (item.prd_coupon_discount || 0)),
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
      deliveryMethod: order.ord_delivery_method.dlv_name
        ? {
            name: order.ord_delivery_method.dlv_name,
            id: order.ord_delivery_method._id,
          }
        : order.ord_delivery_method,
      itemsPrice: order.ord_items_price,
      productDiscount: order.ord_items_discount,
      couponDiscount: order.ord_coupon_discount,
      shippingPrice: order.ord_shipping_price,
      shippingDiscount: order.ord_shipping_discount,
      totalSavings:
        order.ord_items_discount +
        order.ord_coupon_discount +
        order.ord_shipping_discount,
      totalPrice: order.ord_total_price,
      status: order.ord_status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}

module.exports = OrderRepository;
