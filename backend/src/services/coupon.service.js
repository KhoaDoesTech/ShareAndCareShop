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
      throw new BadRequestError('Page and size must be positive integers');
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
          object: coupon,
        })
      ),
      total: totalCoupons,
      page: formatPage,
      size: formatSize,
    });
  }

  async _applyCategoryDiscount(coupon, items, discountDetails) {
    let totalDiscount = 0;

    for (const item of items) {
      const product = await this.productRepository.getById(item.productId);
      if (!product) {
        throw new BadRequestError(`Product ${item.productId} not found`);
      }

      const isEligible = product.category.some((cat) =>
        coupon.targetIds.includes(cat.id.toString())
      );

      if (isEligible) {
        const price = item.variantId
          ? (await this.variantRepository.getById(item.variantId))?.price
          : product.originalPrice;

        if (!price) {
          throw new BadRequestError('Price not found for product or variant');
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
        throw new BadRequestError(`Product ${item.productId} not found`);
      }

      if (coupon.targetIds.includes(product.id.toString())) {
        const price = item.variantId
          ? (await this.variantRepository.getById(item.variantId))?.price
          : product.originalPrice;

        if (!price) {
          throw new BadRequestError('Price not found for product or variant');
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

  _checkCoupon(coupon, userId) {
    if (!coupon) {
      throw new BadRequestError('Coupon code not found');
    }

    if (!coupon.isActive) {
      throw new BadRequestError('Coupon code is not active');
    }

    if (new Date(coupon.startDate) > new Date()) {
      throw new BadRequestError('Coupon code is not yet active');
    }

    if (new Date(coupon.endDate) < new Date()) {
      throw new BadRequestError('Coupon code has expired');
    }

    if (coupon.maxUses <= coupon.usesCount) {
      throw new BadRequestError('Coupon code has reached its maximum uses');
    }

    if (coupon.maxUsesPerUser > 0) {
      const userUsage = coupon.usersUsed.find(
        (user) => user.userId.toString() === userId.toString()
      );

      if (userUsage?.usageCount >= coupon.maxUsesPerUser) {
        throw new BadRequestError(
          `Coupon can only be used ${coupon.maxUsesPerUser} times per user`
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
      throw new BadRequestError('Missing required fields');
    }

    if (
      ['Product', 'Category'].includes(targetType) &&
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
