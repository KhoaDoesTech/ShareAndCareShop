const CouponService = require('../services/coupon.service');
const {
  CreateSuccess,
  NoContentSuccess,
  ActionSuccess,
} = require('../utils/successResponse');

class CouponController {
  constructor() {
    this.couponService = new CouponService();
  }

  createCoupon = async (req, res, next) => {
    new CreateSuccess({
      message: 'Coupon created successfully',
      metadata: await this.couponService.createCoupon(req.body),
    }).send(res);
  };

  reviewDiscount = async (req, res, next) => {
    new ActionSuccess({
      message: 'Coupon reviewed successfully',
      metadata: await this.couponService.reviewDiscount({
        ...req.body,
        userId: req.user.id,
      }),
    }).send(res);
  };

  getAllCoupons = async (req, res, next) => {
    new ActionSuccess({
      message: 'Coupons retrieved successfully',
      metadata: await this.couponService.getAllCoupons(req.query),
    }).send(res);
  };
}

module.exports = new CouponController();
