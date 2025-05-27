'use strict';

const { OrderStatus } = require('../constants/status');
const orderModel = require('../models/order.model');
const APIFeatures = require('../utils/apiFeatures');
const { convertToObjectIdMongodb } = require('../utils/helpers');
const BaseRepository = require('./base.repository');

class OrderRepository extends BaseRepository {
  constructor() {
    super(orderModel);
    this.model = orderModel;
  }

  async getAllOrder({
    filter = {},
    queryOptions = {},
    populateOptions = [
      { path: 'ord_user_id', select: 'usr_name usr_email' },
      { path: 'ord_items.prd_id', select: 'prd_name prd_main_image' },
      { path: 'ord_items.var_id', select: 'var_name var_slug' },
      { path: 'ord_delivery_method', select: 'dlv_name dlv_price' },
    ],
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

  async getById(orderId) {
    const order = await this.model
      .findById(convertToObjectIdMongodb(orderId))
      .populate([
        { path: 'ord_user_id', select: 'usr_name usr_email' },
        { path: 'ord_items.prd_id', select: 'prd_name prd_main_image' },
        { path: 'ord_items.var_id', select: 'var_name var_slug' },
        { path: 'ord_delivery_method', select: 'dlv_name dlv_price' },
      ]);

    return this.formatDocument(order);
  }

  async getByQuery(query) {
    const order = await this.model.findOne(query).populate([
      { path: 'ord_user_id', select: 'usr_name usr_email' },
      { path: 'ord_items.prd_id', select: 'prd_name prd_main_image' },
      { path: 'ord_items.var_id', select: 'var_name var_slug' },
      { path: 'ord_delivery_method', select: 'dlv_name dlv_price' },
    ]);

    return this.formatDocument(order);
  }

  async create(data) {
    const order = await this.model.create(data);
    return this.formatDocument(
      await order.populate([
        { path: 'ord_user_id', select: 'usr_name usr_email' },
        { path: 'ord_items.prd_id', select: 'prd_name prd_main_image' },
        { path: 'ord_items.var_id', select: 'var_name var_slug' },
        { path: 'ord_delivery_method', select: 'dlv_name dlv_price' },
      ])
    );
  }

  async updateById(orderId, updateData) {
    const order = await this.model
      .findByIdAndUpdate(convertToObjectIdMongodb(orderId), updateData, {
        new: true,
      })
      .populate([
        { path: 'ord_user_id', select: 'usr_name usr_email' },
        { path: 'ord_items.prd_id', select: 'prd_name prd_main_image' },
        { path: 'ord_items.var_id', select: 'var_name var_slug' },
        { path: 'ord_delivery_method', select: 'dlv_name dlv_price' },
      ]);

    return this.formatDocument(order);
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

    return result.length ? result[0].totalQuantitySold : 0;
  }

  formatDocument(order) {
    if (!order) return null;

    return {
      id: order._id,
      userId: order.ord_user_id?._id || order.ord_user_id,
      user: order.ord_user_id
        ? {
            name: order.ord_user_id.usr_name,
            email: order.ord_user_id.usr_email,
          }
        : null,
      couponCode: order.ord_coupon_code,
      items: order.ord_items.map((item) => ({
        productId: item.prd_id?._id || item.prd_id,
        variantId: item.var_id?._id || item.var_id,
        productName: item.prd_name,
        variantSlug: item.var_slug || '',
        image: item.prd_img,
        price: item.prd_price,
        quantity: item.prd_quantity,
        productDiscount: item.prd_discount,
        couponDiscount: item.prd_coupon_discount,
        total:
          item.prd_price * item.prd_quantity -
          (item.prd_discount + item.prd_coupon_discount),
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
      deliveryMethod: order.ord_delivery_method
        ? {
            id: order.ord_delivery_method._id,
            name: order.ord_delivery_method.dlv_name || '',
            price: order.ord_delivery_method.dlv_price || 0,
          }
        : null,
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
      isPaid: order.ord_is_paid,
      isDelivered: order.ord_is_delivered,
      paidAt: order.ord_paid_at,
      deliveredAt: order.ord_delivered_at,
      transactionId: order.ord_transaction_id,
      status: order.ord_status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}

module.exports = OrderRepository;
