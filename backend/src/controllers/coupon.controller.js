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
      message: 'Tạo mã giảm giá thành công',
      metadata: await this.couponService.createCoupon(req.body),
    }).send(res);
  };

  reviewDiscount = async (req, res, next) => {
    new ActionSuccess({
      message: 'Kiểm tra mã giảm giá thành công',
      metadata: await this.couponService.reviewDiscount({
        ...req.body,
        userId: req.user.id,
      }),
    }).send(res);
  };

  getAllCoupons = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy danh sách mã giảm giá thành công',
      metadata: await this.couponService.getAllCoupons(req.query),
    }).send(res);
  };
}

module.exports = new CouponController();
