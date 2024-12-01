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

  // async calculateDiscountedPrice({ items, couponCode }) {
  //   const foundCoupon = await this.couponRepository.findByCode(couponCode);
  //   _checkCoupon(foundCoupon);

  //   let totalDiscount = 0;
  //   if (foundCoupon.cpn_target_type === 'Order') {
  //     const totalPrice = items.reduce(
  //       (acc, item) => acc + item.price * item.quantity,
  //       0
  //     );
  //     totalDiscount = _applyDiscount(totalPrice, foundCoupon);
  //   } else if (foundCoupon.cpn_target_type === 'Category') {
  //     const foundProduct = await this.productRepository.getProductByCategory(
  //       foundCoupon.cpn_target_ids
  //     );

  //     const totalPrice = items.reduce((acc, item) => {
  //       const product = foundProduct.find((p) => p.id === item.productId);
  //       return acc + product.price * item.quantity;
  //     }, 0);

  //     totalDiscount = _applyDiscount(totalPrice, foundCoupon);
  //   } else if (foundCoupon.cpn_target_type === 'Product') {
  //     const totalPrice = items.reduce(async (acc, item) => {
  //       const product = await this.productRepository.getById(item.productId);
  //       return acc + product.price * item.quantity;
  //     }, 0);

  //     totalDiscount = _applyDiscount(totalPrice, foundCoupon);
  //   }

  //   return {
  //     totalDiscount,
  //   };
  // }

  _checkCoupon(foundCoupon) {
    if (!foundCoupon) {
      throw new BadRequestError('Coupon code not found');
    }

    if (!foundCoupon.cpn_is_active) {
      throw new BadRequestError('Coupon code is not active');
    }

    if (new Date(foundCoupon.cpn_start_date) > new Date()) {
      throw new BadRequestError('Coupon code is not yet active');
    }

    if (new Date(foundCoupon.cpn_end_date) < new Date()) {
      throw new BadRequestError('Coupon code has expired');
    }

    if (foundCoupon.cpn_max_uses <= foundCoupon.cpn_uses_count) {
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
      discount = maxValue ? Math.min(discount, maxValue) : discount;
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

    if (targetType !== 'Order' && (!targetIds || targetIds.length === 0)) {
      throw new BadRequestError(
        'Target IDs are required for targetType other than "Order"'
      );
    }

    if (new Date(startDate) >= new Date(endDate)) {
      throw new BadRequestError('Start date must be before end date');
    }

    console.log(new Date(startDate));

    if (new Date(endDate) <= new Date()) {
      throw new BadRequestError('End date must be in the future');
    }

    if (value <= 0) {
      throw new BadRequestError('Coupon value must be greater than zero');
    }
  }
}

module.exports = CouponService;
