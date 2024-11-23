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
}

module.exports = new TokenController();
