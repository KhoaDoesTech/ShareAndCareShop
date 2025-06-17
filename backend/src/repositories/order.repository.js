'use strict';

const {
  OrderStatus,
  AvailableOrderStatus,
  ProductStatus,
} = require('../constants/status');
const orderModel = require('../models/order.model');
const APIFeatures = require('../utils/apiFeatures');
const BaseRepository = require('./base.repository');

class OrderRepository extends BaseRepository {
  constructor() {
    super(orderModel);
    this.model = orderModel;
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

  async updateOne(filter, update, options = {}) {
    const document = await this.model
      .findOneAndUpdate(filter, update, {
        new: true,
        ...options,
      })
      .lean();
    return this.formatDocument(document);
  }

  async getById(id, options = {}) {
    let query = this.model.findById(id);
    if (Array.isArray(options.populate)) {
      query = query.populate(options.populate);
    } else {
      query = query
        .populate('ord_user_id', 'usr_name usr_email')
        .populate('ord_delivery_method', 'dlv_name dlv_price')
        .populate({
          path: 'ord_items',
          populate: [
            { path: 'prd_id', select: 'prd_name prd_main_image' },
            { path: 'var_id', select: 'var_name var_slug' },
          ],
        });
    }
    const document = await query.lean();
    return this.formatDocument(document);
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
      .sort()
      .paginate();

    const documents = await features.query.lean();
    return documents.map(this.formatDocument.bind(this));
  }

  async getByQuery({ filter = {}, projection = '', options = {} }) {
    let query = this.model.findOne(filter, projection, options);

    query = query
      .populate('ord_user_id', 'usr_name usr_email')
      .populate('ord_delivery_method', 'dlv_name dlv_price')
      .populate({
        path: 'ord_items',
        populate: [
          { path: 'prd_id', select: 'prd_name prd_main_image' },
          { path: 'var_id', select: 'var_slug' },
        ],
      });

    const document = await query.lean();
    return this.formatDocument(document);
  }

  // Thống kê doanh thu tổng
  async totalRevenue({ startDate, endDate } = {}) {
    const match = { ord_status: OrderStatus.DELIVERED };
    if (startDate && endDate) {
      match.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const result = await this.model.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$ord_total_price' },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    return result.length
      ? {
          totalRevenue: result[0].totalRevenue,
          totalOrders: result[0].totalOrders,
        }
      : { totalRevenue: 0, totalOrders: 0 };
  }

  // Thống kê số lượng đơn hàng theo trạng thái
  async orderStatusCount({ startDate, endDate } = {}) {
    const match = {};
    if (startDate && endDate) {
      match.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const result = await this.model.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$ord_status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCounts = {};
    AvailableOrderStatus.forEach((status) => {
      statusCounts[status] = 0;
    });
    result.forEach((item) => {
      statusCounts[item._id] = item.count;
    });

    return statusCounts;
  }

  // Thống kê sản phẩm bán chạy
  async getTopSellingProducts({
    startDate,
    endDate,
    page = 1,
    size = 10,
  } = {}) {
    const match = { ord_status: OrderStatus.DELIVERED };
    if (startDate && endDate) {
      match.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const skip = (page - 1) * size;
    const result = await this.model.aggregate([
      { $match: match },
      { $unwind: '$ord_items' },
      {
        $lookup: {
          from: 'Products',
          localField: 'ord_items.prd_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $lookup: {
          from: 'Variants',
          localField: 'ord_items.var_id',
          foreignField: '_id',
          as: 'variant',
        },
      },
      {
        $group: {
          _id: {
            productId: '$product._id',
            productName: '$product.prd_name',
            mainImage: '$product.prd_main_image',
            variantId: { $arrayElemAt: ['$variant._id', 0] },
            variantName: { $arrayElemAt: ['$variant.var_slug', 0] },
          },
          totalQuantitySold: { $sum: '$ord_items.prd_quantity' },
          totalRevenue: {
            $sum: {
              $multiply: [
                '$ord_items.prd_price',
                '$ord_items.prd_quantity',
                {
                  $subtract: [
                    1,
                    {
                      $divide: [
                        {
                          $add: [
                            '$ord_items.itm_product_discount',
                            '$ord_items.itm_coupon_discount',
                          ],
                        },
                        '$ord_items.prd_price',
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      {
        $project: {
          productId: '$_id.productId',
          variantId: '$_id.variantId',
          productName: '$_id.productName',
          variantName: '$_id.variantName',
          mainImage: '$_id.mainImage',
          totalQuantitySold: 1,
          totalRevenue: 1,
          _id: 0,
        },
      },
      { $sort: { totalQuantitySold: -1 } },
      { $skip: skip },
      { $limit: size },
    ]);

    const total = await this.model.aggregate([
      { $match: match },
      { $unwind: '$ord_items' },
      { $group: { _id: '$ord_items.prd_id' } },
      { $count: 'total' },
    ]);

    return {
      products: result,
      total: total.length ? total[0].total : 0,
    };
  }

  // Thống kê doanh thu theo danh mục sản phẩm
  async getRevenueByCategory({ startDate, endDate }) {
    // Bước 1: Tính doanh thu theo danh mục
    const match = { ord_status: OrderStatus.DELIVERED };
    if (startDate && endDate) {
      match.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const revenueByCategory = await this.model.aggregate([
      { $match: match },
      { $unwind: '$ord_items' },
      {
        $lookup: {
          from: 'Products',
          localField: 'ord_items.prd_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      { $unwind: '$product.prd_category' },
      {
        $group: {
          _id: '$product.prd_category.id',
          totalRevenue: {
            $sum: {
              $multiply: [
                '$ord_items.prd_price',
                '$ord_items.prd_quantity',
                {
                  $subtract: [
                    1,
                    {
                      $divide: [
                        {
                          $add: [
                            '$ord_items.itm_product_discount',
                            '$ord_items.itm_coupon_discount',
                          ],
                        },
                        '$ord_items.prd_price',
                      ],
                    },
                  ],
                },
              ],
            },
          },
          totalOrders: { $addToSet: '$_id' },
        },
      },
      {
        $project: {
          categoryId: '$_id',
          totalRevenue: 1,
          totalOrders: { $size: '$totalOrders' },
          _id: 0,
        },
      },
    ]);

    return revenueByCategory;
  }

  // Thống kê xu hướng doanh thu
  async revenueTrend({ startDate, endDate, groupBy = 'day' } = {}) {
    if (!startDate || !endDate) {
      throw new Error('Revenue trend requires startDate and endDate');
    }

    const match = { ord_status: OrderStatus.DELIVERED };
    if (startDate && endDate) {
      match.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const groupFields = {
      day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
      week: { $week: '$createdAt' },
      month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
    };

    if (!groupBy in groupFields) {
      throw new Error('Invalid groupBy value. Use "day", "week", or "month".');
    }

    const result = await this.model.aggregate([
      { $match: match },
      {
        $group: {
          _id: groupFields[groupBy],
          totalRevenue: { $sum: '$ord_total_price' },
          totalOrders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return result;
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
        returnDays: item.prd_return_days,
        productDiscount: item.itm_product_discount,
        couponDiscount: item.itm_coupon_discount,
        isReviewed: item.itm_is_reviewed,
        total:
          item.prd_price * item.prd_quantity -
          (item.itm_product_discount + item.itm_coupon_discount),
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
      paymentStatus: order.ord_payment_status,
      deliveryMethod: order.ord_delivery_method
        ? {
            id: order.ord_delivery_method._id,
            name: order.ord_delivery_method.dlv_name || '',
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
