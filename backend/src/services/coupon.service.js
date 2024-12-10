const CouponRepository = require('../repositories/coupon.repository');
const ProductRepository = require('../repositories/product.repository');
const VariantRepository = require('../repositories/variant.repository');
const { BadRequestError } = require('../utils/errorResponse');
const {
  pickFields,
  omitFields,
  convertToObjectIdMongodb,
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
      throw new BadRequestError('Coupon code already exists');
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
      throw new BadRequestError('Coupon not found');
    }

    const userUsageIndex = foundCoupon.usersUsed.findIndex(
      (user) => user.userId.toString() === userId.toString()
    );

    if (userUsageIndex !== -1) {
      foundCoupon.usersUsed[userUsageIndex].usageCount += 1;
    } else {
      foundCoupon.usersUsed.push({
        userId: userId,
        usageCount: 1,
      });
    }

    await this.couponRepository.updateById(foundCoupon.id, {
      $inc: { cpn_uses_count: 1 },
      cpn_users_used: foundCoupon.usersUsed,
    });
  }

  async revokeCouponUsage(couponCode, userId) {
    console.log(couponCode);
    const foundCoupon = await this.couponRepository.findByCode(couponCode);

    if (!foundCoupon) {
      throw new BadRequestError('Coupon not found');
    }

    const userUsageIndex = foundCoupon.usersUsed.findIndex(
      (user) => user.userId.toString() === userId.toString()
    );

    if (userUsageIndex === -1) {
      throw new BadRequestError('User has not used this coupon yet');
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

    // Get the appropriate handler for the coupon's target type
    const TARGET_DISCOUNT_HANDLERS = {
      Order: async () =>
        this._applyOrderDiscount(foundCoupon, totalOrder, discountDetails),
      Delivery: async () =>
        this._applyDeliveryDiscount(foundCoupon, shippingFee, discountDetails),
      Category: async () =>
        this._applyCategoryDiscount(foundCoupon, items, discountDetails),
      Product: async () =>
        this._applyProductDiscount(foundCoupon, items, discountDetails),
    };

    if (TARGET_DISCOUNT_HANDLERS[foundCoupon.targetType]) {
      totalDiscount = await TARGET_DISCOUNT_HANDLERS[foundCoupon.targetType]();
    } else {
      throw new BadRequestError(
        `Unsupported target type: ${foundCoupon.targetType}`
      );
    }

    return {
      totalDiscount,
      discountDetails,
    };
  }

  // TODO: Implement the updateCoupon method
  async getAllCoupons({ page = 1, size = 10 }) {
    const filter = {};
    const formatPage = parseInt(page);
    const formatSize = parseInt(size);

    const query = {
      // sort: mappedSort,
      page: formatPage,
      size: formatSize,
    };

    const coupons = await this.couponRepository.getAll({
      filter,
      queryOptions: query,
    });

    const totalCoupons = await this.productRepository.countDocuments(filter);
    const totalPages = Math.ceil(totalCoupons / size);

    return {
      totalCoupons,
      totalPages,
      currentPage: page,
      coupons: coupons.map((coupon) =>
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
          object: coupon,
        })
      ),
    };
  }

  async _applyCategoryDiscount(coupon, items, discountDetails) {
    let totalDiscount = 0;

    for (const item of items) {
      const product = await this.productRepository.getById(item.productId);
      if (!product) {
        throw new BadRequestError('Product not found');
      }

      const isEligible = product.category.some((cat) =>
        coupon.targetIds.includes(cat.id.toString())
      );

      if (isEligible) {
        const price = item.variantId
          ? (await this.variantRepository.getById(item.variantId))?.price
          : product.price;

        if (!price) {
          throw new BadRequestError('Price not found for product or variant');
        }

        const total = price * item.quantity;
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
        throw new BadRequestError('Product not found');
      }

      if (coupon.targetIds.includes(product.id)) {
        // Lấy giá của variant nếu có
        const price = item.variantId
          ? (await this.variantRepository.getById(item.variantId))?.price
          : product.price;

        if (!price) {
          throw new BadRequestError('Price not found for product or variant');
        }

        // Tính tổng giá trị và giảm giá
        const total = price * item.quantity;
        const discount = this._applyDiscount(total, coupon);
        totalDiscount += discount;

        // Lưu chi tiết
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
    discountDetails.push({
      type: 'Delivery',
      discount,
      shippingFee,
    });

    return discount;
  }

  async _applyOrderDiscount(coupon, totalOrder, discountDetails) {
    const discount = this._applyDiscount(totalOrder, coupon);
    discountDetails.push({
      type: 'Order',
      discount,
      totalOrder,
    });

    return discount;
  }

  _checkCoupon(foundCoupon, userId) {
    if (!foundCoupon) {
      throw new BadRequestError('Coupon code not found');
    }

    if (!foundCoupon.isActive) {
      throw new BadRequestError('Coupon code is not active');
    }

    if (new Date(foundCoupon.startDate) > new Date()) {
      throw new BadRequestError('Coupon code is not yet active');
    }

    if (new Date(foundCoupon.endDate) < new Date()) {
      throw new BadRequestError('Coupon code has expired');
    }

    if (foundCoupon.maxUses <= foundCoupon.usesCount) {
      throw new BadRequestError('Coupon code has reached its maximum uses');
    }

    const maxUser = foundCoupon.maxUsesPerUser;

    if (maxUser > 0) {
      const usersUsedDiscount = foundCoupon.usersUsed.find(
        (user) => user.userId.toString() === userId.toString()
      );

      if (usersUsedDiscount.usageCount >= maxUser) {
        throw new BadRequestError(`Discount just used ${maxUser}`);
      }
    }
  }

  _applyDiscount(basePrice, coupon) {
    const { type, value, maxValue, minValue } = coupon;

    if (basePrice < minValue) {
      return 0;
    }

    let discount = 0;
    if (type === 'AMOUNT') {
      discount = value;
    } else if (type === 'PERCENT') {
      discount = basePrice * (value / 100);
      discount = Math.min(discount, maxValue);
    }

    return discount;
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
      throw new BadRequestError('Missing required fields');
    }

    if (
      (targetType === 'Product' || targetType === 'Category') &&
      (!targetIds || targetIds.length === 0)
    ) {
      throw new BadRequestError('Target IDs are required for targetType');
    }

    if (new Date(startDate) >= new Date(endDate)) {
      throw new BadRequestError('Start date must be before end date');
    }

    if (new Date(endDate) <= new Date()) {
      throw new BadRequestError('End date must be in the future');
    }

    if (value <= 0) {
      throw new BadRequestError('Coupon value must be greater than zero');
    }
  }
}

module.exports = CouponService;
