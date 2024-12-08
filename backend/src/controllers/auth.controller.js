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
      const { email, name } = await this.authService.verifyEmail(req.params);
      res.redirect(
        `${process.env.FRONTEND_URL}/success?message=Email verified successfully&email=${email}&name=${name}`
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
    const { userId, tokens } = await this.authService.socialLogin({
      ...req.user,
      deviceToken: req.session.deviceToken,
      deviceName: req.session.deviceName,
    });

    if (req.session.isPanel) {
      console.log(
        `Redirecting::: ${process.env.ADMIN_PANEL_URL}/?userId=${userId}&refreshToken=${tokens.refreshToken}`
      );
      res.redirect(
        `${process.env.ADMIN_PANEL_URL}/?userId=${userId}&refreshToken=${tokens.refreshToken}`
      );
    } else {
      console.log(
        `Redirecting::: ${process.env.FRONTEND_URL}/?userId=${userId}&refreshToken=${tokens.refreshToken}`
      );
      res.redirect(
        `${process.env.FRONTEND_URL}/?userId=${userId}&refreshToken=${tokens.refreshToken}`
      );
    }
  };

  logIn = async (req, res, next) => {
    new ActionSuccess({
      message: 'User logged in successfully',
      metadata: await this.authService.loginUser({
        ...req.body,
        user: req.user,
      }),
    }).send(res);
  };

  panelLogin = async (req, res, next) => {
    new ActionSuccess({
      message: 'Access to admin panel granted',
    }).send(res);
  };

  logOut = async (req, res, next) => {
    new NoContentSuccess({
      message: 'User logged out successfully',
      metadata: await this.authService.logoutUser({
        userId: req.user.id,
        deviceToken: req.keyStore.deviceToken,
      }),
    }).send(res);
  };

  forgotPassword = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Password reset email sent successfully',
      metadata: await this.authService.forgotPasswordRequest(req.body),
    }).send(res);
  };

  resetPassword = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Password reset successfully',
      metadata: await this.authService.resetForgottenPassword(req.body),
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

module.exports = new AuthController();
