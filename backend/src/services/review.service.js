'use strict';

const {
  OrderStatus,
  ProductStatus,
  SortFieldReview,
} = require('../constants/status');
const OrderRepository = require('../repositories/order.repository');
const ProductRepository = require('../repositories/product.repository');
const VariantRepository = require('../repositories/variant.repository');
const ReviewRepository = require('../repositories/review.repository');
const { BadRequestError, NotFoundError } = require('../utils/errorResponse');
const {
  convertToObjectIdMongodb,
  listResponse,
  pickFields,
} = require('../utils/helpers');

class ReviewService {
  constructor() {
    this.reviewRepository = new ReviewRepository();
    this.orderRepository = new OrderRepository();
    this.productRepository = new ProductRepository();
    this.variantRepository = new VariantRepository();
  }

  async createReview({
    userId,
    productId,
    orderId,
    variantId,
    star,
    content,
    images = [],
  }) {
    // Validate input parameters
    this._validateReviewParams({
      userId,
      productId,
      orderId,
      star,
      content,
      images,
    });

    // Validate product and variant
    await this._validateProductAndVariant(productId, variantId);

    // Check if user can review
    const canReview = await this._canReviewProduct(
      userId,
      productId,
      orderId,
      variantId
    );
    if (!canReview) {
      throw new BadRequestError(
        'Bạn chỉ có thể đánh giá sản phẩm đã mua và chưa từng đánh giá.'
      );
    }

    // Create review
    const reviewData = {
      rvw_user_id: convertToObjectIdMongodb(userId),
      rvw_product_id: convertToObjectIdMongodb(productId),
      rvw_variant_id: variantId ? convertToObjectIdMongodb(variantId) : null,
      rvw_order_id: convertToObjectIdMongodb(orderId),
      rvw_star: star,
      rvw_content: content,
      rvw_images: images,
    };

    const newReview = await this.reviewRepository.create(reviewData);

    // Update isReview in Order
    const filter = {
      _id: convertToObjectIdMongodb(orderId),
      'ord_items.prd_id': convertToObjectIdMongodb(productId),
    };
    if (variantId) {
      filter['ord_items.var_id'] = convertToObjectIdMongodb(variantId);
    }

    const updateResult = await this.orderRepository.updateOne(filter, {
      $set: {
        'ord_items.$.itm_is_reviewed': true,
      },
    });

    console.log(updateResult);

    // Update product rating
    await this._updateProductRating(productId);

    return {
      review: pickFields({
        fields: ['id', 'content', 'star', 'images'],
        object: newReview,
      }),
      averageStar: await this._calculateAverageStar(productId),
    };
  }

  async replyReview({ userId, reviewId, content } = {}) {
    const review = await this.reviewRepository.getById(reviewId);
    if (!review) {
      throw new BadRequestError('Không tìm thấy đánh giá');
    }

    if (review.reply) {
      throw new BadRequestError('Đánh giá này đã được phản hồi');
    }

    const newReply = await this.reviewRepository.updateById(reviewId, {
      rvw_reply: {
        rep_content: content,
        rep_user: userId,
        createdAt: new Date(),
      },
    });

    return pickFields({
      fields: [
        'id',
        'content',
        'star',
        'images',
        'reply.content',
        'reply.createdAt',
      ],
      object: newReply,
    });
  }

  async getReviewsByProduct({
    productId,
    sort,
    page = 1,
    size = 10,
    rating,
    hasImage,
  }) {
    const formatPage = parseInt(page);
    const formatSize = parseInt(size);

    if (!productId || !convertToObjectIdMongodb(productId)) {
      throw new BadRequestError('Mã sản phẩm không hợp lệ');
    }

    const filter = {
      rvw_product_id: convertToObjectIdMongodb(productId),
      rvw_is_hidden: false,
    };
    if (rating) {
      filter.rvw_star = parseInt(rating);
    }

    const hasImageBool = hasImage === true || hasImage === 'true';
    const hasImageFalse = hasImage === false || hasImage === 'false';

    if (hasImageBool) {
      filter.rvw_images = { $exists: true, $ne: [], $not: { $size: 0 } };
    } else if (hasImageFalse) {
      filter.$or = [
        { rvw_images: { $exists: false } },
        { rvw_images: { $size: 0 } },
      ];
    }

    const mappedSort = sort
      ? `${sort.startsWith('-') ? '-' : ''}${
          SortFieldReview[sort.replace('-', '')] || 'createdAt'
        }`
      : '-createdAt';

    const query = {
      sort: mappedSort,
      page: formatPage,
      size: formatSize,
    };

    const reviews = await this.reviewRepository.getAll({
      filter,
      queryOptions: query,
      populateOptions: [
        { path: 'rvw_user_id', select: 'usr_name usr_avatar' },
        { path: 'rvw_reply.rep_user', select: 'usr_name usr_avatar' },
      ],
    });

    const totalReviews = await this.reviewRepository.countDocuments(filter);

    return listResponse({
      items: reviews.map((review) => ({
        id: review.id,
        content: review.content,
        star: review.star,
        images: review.images,
        user: review.userId,
        reply: review.reply,
        createdAt: review.createdAt,
      })),
      total: totalReviews,
      page: formatPage,
      size: formatSize,
    });
  }

  async getReviewsDetailsByUser({ userId, orderId, productId, variantId }) {
    const product = await this._validateProductAndVariant(productId, variantId);

    // Validate order
    const order = await this._validateOrder(userId, orderId);

    // Fetch review
    const filter = {
      rvw_user_id: convertToObjectIdMongodb(userId),
      rvw_order_id: convertToObjectIdMongodb(orderId),
      rvw_product_id: convertToObjectIdMongodb(productId),
      rvw_variant_id: variantId ? convertToObjectIdMongodb(variantId) : null,
      rvw_is_hidden: false,
    };
    const populateOptions = [
      { path: 'rvw_reply.rep_user', select: 'usr_name usr_avatar' },
    ];

    const review = await this.reviewRepository.getByQuery(
      filter,
      populateOptions
    );

    if (!review) {
      throw new NotFoundError('Không tìm thấy đánh giá');
    }

    // Find matching item in ord_items
    const orderItem = order.items?.find((item) => {
      const matchesProduct = item.productId.toString() === productId.toString();
      const matchesVariant =
        product.variants?.length > 0
          ? variantId && item.variantId?.toString() === variantId.toString()
          : true; // Ignore variant if no variants
      return matchesProduct && matchesVariant;
    });

    return {
      order: pickFields({
        fields: [
          'productId',
          'variantId',
          'productName',
          'variantSlug',
          'image',
        ],
        object: orderItem,
      }),
      review: pickFields({
        fields: ['id', 'content', 'star', 'images', 'createdAt', 'reply'],
        object: review,
      }),
    };
  }

  async getUnrepliedReviews({ page = 1, size = 10, isReplied }) {
    const formatPage = parseInt(page);
    const formatSize = parseInt(size);

    const filter = {
      rvw_is_hidden: false,
    };

    if (typeof isReplied !== 'undefined' && isReplied !== null) {
      const replied = isReplied === true || isReplied === 'true';
      if (replied) {
        filter.rvw_reply = { $ne: null };
      } else {
        filter.rvw_reply = null;
      }
    }

    const query = {
      sort: '-createdAt',
      page: formatPage,
      size: formatSize,
    };

    const reviews = await this.reviewRepository.getAll({
      filter,
      queryOptions: query,
    });

    const totalReviews = await this.reviewRepository.countDocuments(filter);

    return listResponse({
      items: reviews.map((review) =>
        pickFields({
          fields: [
            'id',
            'content',
            'star',
            'images',
            'userId',
            'orderId',
            'productId',
            'variantId',
            'createdAt',
          ],
          object: review,
        })
      ),
      total: totalReviews,
      page: formatPage,
      size: formatSize,
    });
  }

  async hideReview({ reviewId }) {
    const review = await this.reviewRepository.getById(reviewId);
    if (!review) {
      throw new BadRequestError('Không tìm thấy đánh giá');
    }

    const updatedReview = await this.reviewRepository.updateById(reviewId, {
      rvw_is_hidden: true,
    });
    console.log(review);

    // Update product rating
    await this._updateProductRating(review.productId);

    return pickFields({
      fields: ['id', 'isHidden'],
      object: updatedReview,
    });
  }

  async getReviewById({ reviewId }) {
    const review = await this.reviewRepository.getById(reviewId, [
      { path: 'rvw_user_id', select: 'usr_name usr_avatar' },
      { path: 'rvw_reply.rep_user', select: 'usr_name usr_avatar' },
      { path: 'rvw_reports.user_id', select: 'usr_name usr_avatar' },
    ]);

    if (!review) {
      throw new NotFoundError('Không tìm thấy đánh giá hoặc đánh giá đã bị ẩn');
    }

    return {
      id: review.id,
      orderId: review.orderId,
      productId: review.productId,
      variantId: review.variantId,
      content: review.content,
      star: review.star,
      images: review.images,
      user: review.userId,
      reply: review.reply,
      reports: review.reports,
      isHidden: review.isHidden,
      createdAt: review.createdAt,
    };
  }

  async reportReview({ userId, reviewId, reason }) {
    const review = await this.reviewRepository.getById(reviewId);
    if (!review) {
      throw new BadRequestError('Không tìm thấy đánh giá');
    }

    const updatedReview = await this.reviewRepository.updateById(reviewId, {
      $push: {
        rvw_reports: {
          user_id: convertToObjectIdMongodb(userId),
          reason,
          createdAt: new Date(),
        },
      },
    });

    return pickFields({
      fields: ['id', 'reports'],
      object: {
        id: updatedReview.id,
        reports: updatedReview.reports,
      },
    });
  }

  async _validateReviewParams({
    userId,
    productId,
    orderId,
    star,
    content,
    images,
  }) {
    if (!userId || !productId || !orderId || !star || !content) {
      throw new BadRequestError('Thiếu thông tin bắt buộc để tạo đánh giá');
    }
    if (star < 1 || star > 5) {
      throw new BadRequestError('Số sao phải từ 1 đến 5');
    }
    if (!Array.isArray(images)) {
      throw new BadRequestError('Danh sách ảnh phải là một mảng URL');
    }
    for (const img of images) {
      if (typeof img !== 'string' || !img.startsWith('http')) {
        throw new BadRequestError('Mỗi ảnh phải là một URL hợp lệ');
      }
    }
  }

  async _validateProductAndVariant(productId, variantId) {
    const product = await this.productRepository.getById(productId);
    if (!product) {
      throw new BadRequestError('Không tìm thấy sản phẩm');
    }

    if (product.variants?.length > 0 && !variantId) {
      throw new BadRequestError(
        'Sản phẩm này có biến thể, vui lòng cung cấp mã biến thể'
      );
    }

    if (variantId) {
      const variant = await this.variantRepository.getByQuery({
        filter: { _id: convertToObjectIdMongodb(variantId), prd_id: productId },
      });
      if (!variant) {
        throw new BadRequestError('Không tìm thấy biến thể');
      }
    }

    return product;
  }

  async _validateOrder(userId, orderId) {
    const order = await this.orderRepository.getById(orderId);

    if (!order || order.userId.toString() !== userId.toString()) {
      throw new BadRequestError(
        'Không tìm thấy đơn hàng hoặc đơn hàng không thuộc về người dùng'
      );
    }
    if (![OrderStatus.DELIVERED, OrderStatus.RETURN].includes(order.status)) {
      throw new BadRequestError(
        'Chỉ đơn hàng đã giao hoặc đã hoàn trả mới được đánh giá'
      );
    }

    return order;
  }

  async _getProductsByIds(
    productIds,
    statusFilter = [ProductStatus.PUBLISHED, ProductStatus.OUT_OF_STOCK]
  ) {
    if (!productIds || productIds.length === 0) {
      return [];
    }

    return await this.productRepository.getAll({
      filter: {
        _id: { $in: productIds.map((id) => convertToObjectIdMongodb(id)) },
        prd_status: { $in: statusFilter },
      },
    });
  }

  async _calculateAverageStar(productId) {
    const reviews = await this.reviewRepository.getAll({
      filter: {
        rvw_product_id: convertToObjectIdMongodb(productId),
        rvw_is_hidden: false,
      },
    });

    if (!reviews || reviews.length === 0) {
      return 0;
    }

    const totalStars = reviews.reduce((sum, review) => sum + review.star, 0);
    return parseFloat((totalStars / reviews.length).toFixed(2));
  }

  async _updateProductRating(productId) {
    const averageStar = await this._calculateAverageStar(productId);
    await this.productRepository.updateById(productId, {
      prd_rating: averageStar,
      prd_rating_count: await this.reviewRepository.countDocuments({
        rvw_product_id: convertToObjectIdMongodb(productId),
        rvw_is_hidden: false,
      }),
    });
  }

  async _canReviewProduct(userId, productId, orderId, variantId) {
    const order = await this._validateOrder(userId, orderId);
    const purchasedItems = order.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId || null,
    }));

    const hasPurchased = purchasedItems.some(
      (item) =>
        item.productId.toString() === productId.toString() &&
        (!variantId || item.variantId?.toString() === variantId.toString())
    );

    if (!hasPurchased) {
      return false;
    }

    const reviewFilter = {
      rvw_user_id: convertToObjectIdMongodb(userId),
      rvw_product_id: convertToObjectIdMongodb(productId),
      rvw_order_id: convertToObjectIdMongodb(orderId),
      rvw_variant_id: variantId ? convertToObjectIdMongodb(variantId) : null,
      rvw_is_hidden: false,
    };

    const existingReview = await this.reviewRepository.getByQuery(reviewFilter);
    return !existingReview;
  }
}

module.exports = ReviewService;
