const CouponRepository = require('../repositories/coupon.repository');
const ProductRepository = require('../repositories/product.repository');
const { BadRequestError } = require('../utils/errorResponse');
const { pickFields, omitFields } = require('../utils/helpers');

class CouponService {
  constructor() {
    this.couponRepository = new CouponRepository();
    this.productRepository = new ProductRepository();
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

  async reviewDiscount({ items, totalOrder, shippingFee, couponCode }) {
    const foundCoupon = await this.couponRepository.findByCode(couponCode);
    this._checkCoupon(foundCoupon);

    const discountDetails = [];
    let totalDiscount = 0;

    // Get the appropriate handler for the coupon's target type
    const TARGET_DISCOUNT_HANDLERS = {
      Order: async () =>
        this._applyOrderDiscount(foundCoupon, totalOrder, discountDetails),
      Delivery: async () =>
        this._applyDeliveryDiscount(foundCoupon, shippingFee, discountDetails),
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

  _checkCoupon(foundCoupon) {
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
