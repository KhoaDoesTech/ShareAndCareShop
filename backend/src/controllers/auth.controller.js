const AuthService = require('../services/auth.service');
const TokenService = require('../services/token.service');
const {
  ActionSuccess,
  CreateSuccess,
  NoContentSuccess,
} = require('../utils/successResponse');

class AuthController {
  constructor() {
    this.authService = new AuthService();
    this.tokenService = new TokenService();
  }

  registerUser = async (req, res, next) => {
    new CreateSuccess({
      message:
        'Users registered successfully and verification email has been sent on your email',
      metadata: await this.authService.registerUser(req.body),
    }).send(res);
  };

  verifyEmail = async (req, res, next) => {
    try {
      const tokens = await this.authService.verifyEmail(req.params);
      res.redirect(
        `${process.env.CLIENT_SSO_REDIRECT_URL}?refreshToken=${tokens.refreshToken}`
      );
    } catch (error) {
      res.redirect(
        `${process.env.FRONTEND_URL}/error?message=${error.message}`
      );
    }
  };

  resendVerificationEmail = async (req, res, next) => {
    new ActionSuccess({
      message: 'Verification email sent successfully',
      metadata: await this.authService.resendVerificationEmail(req.body),
    }).send(res);
  };

  socialLogin = async (req, res, next) => {
    const tokens = req.user;
    res.redirect(
      `${process.env.CLIENT_SSO_REDIRECT_URL}?refreshToken=${tokens.refreshToken}`
    );
  };

  logIn = async (req, res, next) => {
    new ActionSuccess({
      message: 'User logged in successfully',
      metadata: await this.authService.loginUser(req.body),
    }).send(res);
  };

  logOut = async (req, res, next) => {
    new NoContentSuccess({
      message: 'User logged out successfully',
      metadata: await this.authService.logoutUser(req.user),
    }).send(res);
  };

  refreshAccessToken = async (req, res, next) => {
    new ActionSuccess({
      message: 'Access token refreshed successfully',
      metadata: await this.tokenService.refreshAccessToken({
        refreshToken: req.refreshToken,
        user: req.user,
      }),
    }).send(res);
  };

  updateUserAvatar = async (req, res, next) => {
    new ActionSuccess({
      message: 'Avatar uploaded successfully',
      metadata: await this.authService.updateUserAvatar({
        file: req.file,
        user: req.user,
      }),
    }).send(res);
  };
}

module.exports = AuthController;
