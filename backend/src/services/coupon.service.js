const { ProductStatus } = require('../constants/status');
const CouponRepository = require('../repositories/coupon.repository');
const ProductRepository = require('../repositories/product.repository');
const VariantRepository = require('../repositories/variant.repository');
const { BadRequestError } = require('../utils/errorResponse');
const {
  pickFields,
  omitFields,
  convertToObjectIdMongodb,
  listResponse,
} = require('../utils/helpers');

class CouponService {
  constructor() {
    this.couponRepository = new CouponRepository();
    this.productRepository = new ProductRepository();
    this.variantRepository = new VariantRepository();
  }

  async createCoupon({
    name,
    code,
    description,
    startDate,
    endDate,
    type,
    value,
    minValue,
    maxValue,
    maxUses,
    maxUsesPerUser,
    targetType,
    targetIds,
  }) {
    this._validateCouponPayload({
      code,
      startDate,
      endDate,
      value,
      targetType,
      targetIds,
    });

    const existingCoupon = await this.couponRepository.findByCode(code);
    if (existingCoupon) {
      throw new BadRequestError('Mã giảm giá đã tồn tại');
    }

    const newCoupon = await this.couponRepository.create({
      cpn_name: name,
      cpn_code: code,
      cpn_description: description,
      cpn_start_date: startDate,
      cpn_end_date: endDate,
      cpn_type: type,
      cpn_value: value,
      cpn_min_value: minValue,
      cpn_max_value: maxValue,
      cpn_max_uses: maxUses,
      cpn_max_uses_per_user: maxUsesPerUser,
      cpn_target_type: targetType,
      cpn_target_ids: targetIds,
    });

    return {
      coupon: omitFields({
        fields: ['id', 'usesCount', 'usersUsed', 'createdAt', 'updatedAt'],
        object: newCoupon,
      }),
    };
  }

  async useCoupon(couponCode, userId) {
    const foundCoupon = await this.couponRepository.findByCode(couponCode);
    if (!foundCoupon) {
      throw new BadRequestError('Không tìm thấy mã giảm giá');
    }

    const userUsageIndex = foundCoupon.usersUsed.findIndex(
      (user) => user.userId.toString() === userId.toString()
    );

    if (userUsageIndex !== -1) {
      foundCoupon.usersUsed[userUsageIndex].usageCount += 1;
    } else {
      foundCoupon.usersUsed.push({ userId, usageCount: 1 });
    }

    await this.couponRepository.updateById(foundCoupon.id, {
      $inc: { cpn_uses_count: 1 },
      cpn_users_used: foundCoupon.usersUsed,
    });
  }

  async revokeCouponUsage(couponCode, userId) {
    const foundCoupon = await this.couponRepository.findByCode(couponCode);
    if (!foundCoupon) {
      throw new BadRequestError('Không tìm thấy mã giảm giá');
    }

    const userUsageIndex = foundCoupon.usersUsed.findIndex(
      (user) => user.userId.toString() === userId.toString()
    );

    if (userUsageIndex === -1) {
      throw new BadRequestError('Người dùng chưa sử dụng mã giảm giá này');
    }

    foundCoupon.usersUsed[userUsageIndex].usageCount -= 1;
    if (foundCoupon.usersUsed[userUsageIndex].usageCount <= 0) {
      foundCoupon.usersUsed.splice(userUsageIndex, 1);
    }

    await this.couponRepository.updateById(foundCoupon.id, {
      $inc: { cpn_uses_count: -1 },
      cpn_users_used: foundCoupon.usersUsed,
    });
  }

  async reviewDiscount({ userId, items, totalOrder, shippingFee, couponCode }) {
    const foundCoupon = await this.couponRepository.findByCode(couponCode);
    this._checkCoupon(foundCoupon, userId);

    const discountDetails = [];
    let totalDiscount = 0;

    const handlers = {
      Order: async () =>
        this._applyOrderDiscount(foundCoupon, totalOrder, discountDetails),
      Delivery: async () =>
        this._applyDeliveryDiscount(foundCoupon, shippingFee, discountDetails),
      Category: async () =>
        this._applyCategoryDiscount(foundCoupon, items, discountDetails),
      Product: async () =>
        this._applyProductDiscount(foundCoupon, items, discountDetails),
    };

    const handler = handlers[foundCoupon.targetType];
    if (!handler) {
      throw new BadRequestError(
        `Unsupported target type: ${foundCoupon.targetType}`
      );
    }

    totalDiscount = await handler();
    return { totalDiscount, discountDetails };
  }

  async getAllCoupons({ page = 1, size = 10 }) {
    const formatPage = parseInt(page, 10);
    const formatSize = parseInt(size, 10);

    if (formatPage < 1 || formatSize < 1) {
      throw new BadRequestError('Trang và kích thước phải là số nguyên dương');
    }

    const filter = {};
    const queryOptions = { page: formatPage, size: formatSize };

    const coupons = await this.couponRepository.getAll({
      filter,
      queryOptions,
    });
    const totalCoupons = await this.couponRepository.countDocuments(filter);

    return listResponse({
      items: coupons.map((coupon) =>
        pickFields({
          fields: [
            'id',
            'name',
            'code',
            'startDate',
            'endDate',
            'type',
            'value',
            'targetType',
            'isActive',
          ],
          object: {
            ...coupon,
            isActive: this._checkCouponActive(coupon),
          },
        })
      ),
      total: totalCoupons,
      page: formatPage,
      size: formatSize,
    });
  }

  async getCouponDetailsByAdmin({ couponKey, page = 1, size = 10 }) {
    const coupon = await this.couponRepository.getCouponByIndentifier(
      couponKey
    );
    if (!coupon) {
      throw new BadRequestError('Không tìm thấy mã giảm giá');
    }

    let targets = [];
    let totalTargets = 0;
    const formatPage = parseInt(page, 10);
    const formatSize = parseInt(size, 10);
    const queryOptions = { page: formatPage, size: formatSize };

    try {
      if (coupon.targetType === 'Product') {
        const filter = {
          _id: { $in: coupon.targetIds },
        };
        targets = await this.productRepository.getAll({
          filter,
          queryOptions,
        });
        totalTargets = await this.productRepository.countDocuments(filter);
      } else if (coupon.targetType === 'Category') {
        const filter = {
          prd_category: {
            $elemMatch: {
              id: { $in: coupon.targetIds },
            },
          },
        };
        targets = await this.productRepository.getAll({
          filter,
          queryOptions,
        });
        totalTargets = await this.productRepository.countDocuments(filter);
      }
    } catch (error) {
      throw new BadRequestError(
        `Lỗi khi lấy thông tin mục tiêu: ${error.message}`
      );
    }

    return {
      coupon: {
        ...omitFields({
          fields: ['isActive'],
          object: coupon,
        }),
        isActive: this._checkCouponActive(coupon),
      },
      targets: listResponse({
        items: targets.map((target) =>
          pickFields({
            fields: ['id', 'code', 'name', 'mainImage'],
            object: target,
          })
        ),
        total: totalTargets,
        page: formatPage,
        size: formatSize,
      }),
    };
  }

  async getCouponDetailsByUser({ couponKey, page = 1, size = 10 }) {
    const coupon = await this.couponRepository.getCouponByIndentifier(
      couponKey
    );
    this._checkCouponByUser(coupon);

    let targets = [];
    let totalTargets = 0;
    const formatPage = parseInt(page, 10);
    const formatSize = parseInt(size, 10);
    const queryOptions = { page: formatPage, size: formatSize };

    try {
      if (coupon.targetType === 'Product') {
        const filter = {
          _id: { $in: coupon.targetIds },
          prd_status: ProductStatus.PUBLISHED,
        };
        targets = await this.productRepository.getAll({
          filter,
          queryOptions,
        });
        totalTargets = await this.productRepository.countDocuments(filter);
      } else if (coupon.targetType === 'Category') {
        const filter = {
          prd_status: ProductStatus.PUBLISHED,
          prd_category: {
            $elemMatch: {
              id: { $in: coupon.targetIds },
            },
          },
        };
        targets = await this.productRepository.getAll({
          filter,
          queryOptions,
        });
        totalTargets = await this.productRepository.countDocuments(filter);
      }
    } catch (error) {
      throw new BadRequestError(
        `Lỗi khi lấy thông tin mục tiêu: ${error.message}`
      );
    }

    return {
      coupon: omitFields({
        fields: [
          'maxUses',
          'usesCount',
          'usersUsed',
          'createdAt',
          'updatedAt',
          'isActive',
        ],
        object: coupon,
      }),
      targets: listResponse({
        items: targets.map((target) =>
          pickFields({
            fields: ['id', 'code', 'name', 'mainImage'],
            object: target,
          })
        ),
        total: totalTargets,
        page: formatPage,
        size: formatSize,
      }),
    };
  }

  async _applyCategoryDiscount(coupon, items, discountDetails) {
    let totalDiscount = 0;

    for (const item of items) {
      const product = await this.productRepository.getById(item.productId);
      if (!product) {
        throw new BadRequestError(`Không tìm thấy sản phẩm ${item.productId}`);
      }

      const isEligible = product.category.some((cat) =>
        coupon.targetIds.includes(cat.id.toString())
      );

      if (isEligible) {
        const price = item.variantId
          ? (await this.variantRepository.getById(item.variantId))?.price
          : product.originalPrice;

        if (!price) {
          throw new BadRequestError(
            'Không tìm thấy giá sản phẩm hoặc biến thể'
          );
        }

        // Apply product discount first
        let itemPrice = price;
        const now = new Date();
        const isProductDiscountActive =
          product.discountStart &&
          product.discountEnd &&
          now >= new Date(product.discountStart) &&
          now <= new Date(product.discountEnd) &&
          product.discountValue > 0;

        if (isProductDiscountActive) {
          itemPrice =
            product.discountType === 'AMOUNT'
              ? Math.max(0, price - product.discountValue)
              : Math.max(0, price * (1 - product.discountValue / 100));
        }

        const total = itemPrice * item.quantity;
        const discount = this._applyDiscount(total, coupon);
        totalDiscount += discount;

        discountDetails.push({
          productId: product.id,
          variantId: item.variantId || null,
          quantity: item.quantity,
          total,
          discount,
        });
      }
    }

    return totalDiscount;
  }

  async _applyProductDiscount(coupon, items, discountDetails) {
    let totalDiscount = 0;

    for (const item of items) {
      const product = await this.productRepository.getById(item.productId);
      if (!product) {
        throw new BadRequestError(`Không tìm thấy sản phẩm ${item.productId}`);
      }

      if (coupon.targetIds.includes(product.id.toString())) {
        const price = item.variantId
          ? (await this.variantRepository.getById(item.variantId))?.price
          : product.originalPrice;

        if (!price) {
          throw new BadRequestError(
            'Không tìm thấy giá sản phẩm hoặc biến thể'
          );
        }

        // Apply product discount first
        let itemPrice = price;
        const now = new Date();
        const isProductDiscountActive =
          product.discountStart &&
          product.discountEnd &&
          now >= new Date(product.discountStart) &&
          now <= new Date(product.discountEnd) &&
          product.discountValue > 0;

        if (isProductDiscountActive) {
          itemPrice =
            product.discountType === 'AMOUNT'
              ? Math.max(0, price - product.discountValue)
              : Math.max(0, price * (1 - product.discountValue / 100));
        }

        const total = itemPrice * item.quantity;
        const discount = this._applyDiscount(total, coupon);
        totalDiscount += discount;

        discountDetails.push({
          productId: product.id,
          variantId: item.variantId || null,
          quantity: item.quantity,
          total,
          discount,
        });
      }
    }

    return totalDiscount;
  }

  async _applyDeliveryDiscount(coupon, shippingFee, discountDetails) {
    const discount = this._applyDiscount(shippingFee, coupon);
    discountDetails.push({ type: 'Delivery', discount, shippingFee });
    return discount;
  }

  async _applyOrderDiscount(coupon, totalOrder, discountDetails) {
    const discount = this._applyDiscount(totalOrder, coupon);
    discountDetails.push({ type: 'Order', discount, totalOrder });
    return discount;
  }

  _checkCouponActive(coupon) {
    const now = new Date();
    if (coupon.startDate && now < new Date(coupon.startDate)) {
      return false;
    }
    if (coupon.endDate && now > new Date(coupon.endDate)) {
      return false;
    }
    if (coupon.maxUses && coupon.usesCount >= coupon.maxUses) {
      return false;
    }
    return coupon.isActive;
  }

  _checkCouponByUser(coupon) {
    if (!coupon) {
      throw new BadRequestError('Không tìm thấy mã giảm giá');
    }

    if (!coupon.isActive) {
      throw new BadRequestError('Mã giảm giá không còn hiệu lực');
    }

    if (new Date(coupon.startDate) > new Date()) {
      throw new BadRequestError('Mã giảm giá chưa đến thời gian sử dụng');
    }

    if (new Date(coupon.endDate) < new Date()) {
      throw new BadRequestError('Mã giảm giá đã hết hạn');
    }

    if (coupon.maxUses <= coupon.usesCount) {
      throw new BadRequestError('Mã giảm giá đã đạt số lần sử dụng tối đa');
    }
  }

  _checkCoupon(coupon, userId) {
    if (!coupon) {
      throw new BadRequestError('Không tìm thấy mã giảm giá');
    }

    if (!coupon.isActive) {
      throw new BadRequestError('Mã giảm giá không còn hiệu lực');
    }

    if (new Date(coupon.startDate) > new Date()) {
      throw new BadRequestError('Mã giảm giá chưa đến thời gian sử dụng');
    }

    if (new Date(coupon.endDate) < new Date()) {
      throw new BadRequestError('Mã giảm giá đã hết hạn');
    }

    if (coupon.maxUses <= coupon.usesCount) {
      throw new BadRequestError('Mã giảm giá đã đạt số lần sử dụng tối đa');
    }

    if (coupon.maxUsesPerUser > 0) {
      const userUsage = coupon.usersUsed.find(
        (user) => user.userId.toString() === userId.toString()
      );

      if (userUsage?.usageCount >= coupon.maxUsesPerUser) {
        throw new BadRequestError(
          `Mỗi người dùng chỉ được sử dụng mã giảm giá này tối đa ${coupon.maxUsesPerUser} lần`
        );
      }
    }
  }

  _applyDiscount(basePrice, coupon) {
    const { type, value, maxValue, minValue } = coupon;

    if (basePrice < minValue) {
      return 0;
    }

    let discount = type === 'AMOUNT' ? value : basePrice * (value / 100);
    if (type === 'PERCENT' && maxValue) {
      discount = Math.min(discount, maxValue);
    }

    return Math.max(0, discount);
  }

  _validateCouponPayload({
    code,
    startDate,
    endDate,
    value,
    targetType,
    targetIds,
  }) {
    if (!code || !startDate || !endDate || !value) {
      throw new BadRequestError('Thiếu trường thông tin bắt buộc');
    }

    if (
      ['Product', 'Category'].includes(targetType) &&
      (!targetIds || targetIds.length === 0)
    ) {
      throw new BadRequestError(
        'Cần cung cấp danh sách đối tượng áp dụng cho loại này'
      );
    }

    if (new Date(startDate) >= new Date(endDate)) {
      throw new BadRequestError('Ngày bắt đầu phải trước ngày kết thúc');
    }

    if (new Date(endDate) <= new Date()) {
      throw new BadRequestError('Ngày kết thúc phải lớn hơn ngày hiện tại');
    }

    if (value <= 0) {
      throw new BadRequestError('Giá trị mã giảm giá phải lớn hơn 0');
    }
  }
}

module.exports = CouponService;
