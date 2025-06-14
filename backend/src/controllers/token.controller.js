const TokenService = require('../services/token.service');
const {
  ActionSuccess,
  CreateSuccess,
  NoContentSuccess,
} = require('../utils/successResponse');

class TokenController {
  constructor() {
    this.tokenService = new TokenService();
  }

  refreshAccessToken = async (req, res, next) => {
    new ActionSuccess({
      message: 'Làm mới access token thành công',
      metadata: await this.tokenService.refreshAccessToken({
        user: req.user,
        keyStore: req.keyStore,
      }),
    }).send(res);
  };

  getTokens = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy danh sách thiết bị thành công',
      metadata: await this.tokenService.getDeviceTokens({
        user: req.user,
        currentToken: req.keyStore.deviceToken,
      }),
    }).send(res);
  };

  updateDeviceName = async (req, res, next) => {
    new ActionSuccess({
      message: 'Cập nhật tên thiết bị thành công',
      metadata: await this.tokenService.updateDeviceName({
        user: req.user,
        deviceToken: req.body.deviceToken,
        deviceName: req.body.deviceName,
      }),
    }).send(res);
  };

  deleteToken = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Xóa thiết bị thành công',
      metadata: await this.tokenService.deleteToken({
        user: req.user,
        deviceToken: req.body.deviceToken,
      }),
    }).send(res);
  };

  deleteAllTokens = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Xóa tất cả thiết bị thành công',
      metadata: await this.tokenService.deleteAllTokens({
        user: req.user,
        currentToken: req.keyStore.deviceToken,
      }),
    }).send(res);
  };
}

module.exports = new TokenController();
