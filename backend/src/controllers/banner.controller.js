'use strict';

const BannerService = require('../services/banner.service');
const {
  CreateSuccess,
  ActionSuccess,
  NoContentSuccess,
} = require('../utils/successResponse');

class BannerController {
  constructor() {
    this.bannerService = new BannerService();
  }

  createBanner = async (req, res, next) => {
    new CreateSuccess({
      message: 'Tạo banner thành công',
      metadata: await this.bannerService.createBanner({
        userId: req.user.id,
        ...req.body,
      }),
    }).send(res);
  };

  updateBanner = async (req, res, next) => {
    new ActionSuccess({
      message: 'Cập nhật banner thành công',
      metadata: await this.bannerService.updateBanner({
        bannerId: req.params.bannerId,
        userId: req.user.id,
        ...req.body,
        imageFile: req.file, // nếu có upload file
      }),
    }).send(res);
  };

  deleteBanner = async (req, res, next) => {
    new ActionSuccess({
      message: 'Xóa banner thành công',
      metadata: await this.bannerService.deleteBanner({
        bannerId: req.params.bannerId,
      }),
    }).send(res);
  };

  getAllBannersPublic = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy danh sách banner thành công',
      metadata: await this.bannerService.getAllBannersPublic(req.query),
    }).send(res);
  };

  getAllBannersAdmin = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy danh sách banner (admin) thành công',
      metadata: await this.bannerService.getAllBannersAdmin(req.query),
    }).send(res);
  };

  getBannerDetailsPublic = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy chi tiết banner thành công',
      metadata: await this.bannerService.getBannerDetailsPublic({
        bannerId: req.params.bannerId,
      }),
    }).send(res);
  };

  getBannerDetailsAdmin = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy chi tiết banner (admin) thành công',
      metadata: await this.bannerService.getBannerDetailsAdmin({
        bannerId: req.params.bannerId,
      }),
    }).send(res);
  };

  publishBanner = async (req, res, next) => {
    new ActionSuccess({
      message: 'Kích hoạt banner thành công',
      metadata: await this.bannerService.publishBanner({
        bannerId: req.params.bannerId,
      }),
    }).send(res);
  };

  unpublishBanner = async (req, res, next) => {
    new ActionSuccess({
      message: 'Hủy kích hoạt banner thành công',
      metadata: await this.bannerService.unpublishBanner({
        bannerId: req.params.bannerId,
      }),
    }).send(res);
  };

  updateBannerOrders = async (req, res, next) => {
    new ActionSuccess({
      message: 'Cập nhật thứ tự banner thành công',
      metadata: await this.bannerService.updateBannerOrders({
        bannerOrders: req.body.bannerOrders,
      }),
    }).send(res);
  };

  deleteExpiredBanners = async (req, res, next) => {
    new ActionSuccess({
      message: 'Xóa các banner hết hạn thành công',
      metadata: await this.bannerService.deleteExpiredBanners(),
    }).send(res);
  };
}

module.exports = new BannerController();
