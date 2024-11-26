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
      message: 'Access token refreshed successfully',
      metadata: await this.tokenService.refreshAccessToken({
        user: req.user,
        keyStore: req.keyStore,
      }),
    }).send(res);
  };

  getTokens = async (req, res, next) => {
    new ActionSuccess({
      message: 'Tokens retrieved successfully',
      metadata: await this.tokenService.getDeviceTokens({
        user: req.user,
        currentToken: req.keyStore.deviceToken,
      }),
    }).send(res);
  };

  updateDeviceName = async (req, res, next) => {
    new ActionSuccess({
      message: 'Device name updated successfully',
      metadata: await this.tokenService.updateDeviceName({
        user: req.user,
        deviceToken: req.body.deviceToken,
        deviceName: req.body.deviceName,
      }),
    }).send(res);
  };

  deleteToken = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Token deleted successfully',
      metadata: await this.tokenService.deleteToken({
        user: req.user,
        deviceToken: req.body.deviceToken,
      }),
    }).send(res);
  };

  deleteAllTokens = async (req, res, next) => {
    new NoContentSuccess({
      message: 'All tokens deleted successfully',
      metadata: await this.tokenService.deleteAllTokens({
        user: req.user,
        currentToken: req.keyStore.deviceToken,
      }),
    }).send(res);
  };
}

module.exports = new TokenController();
