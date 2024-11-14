'use strict';

const express = require('express');
const AuthController = require('../../../controllers/auth.controller');
const {
  userRegisterValidator,
  userLoginValidator,
} = require('../../../validators/auth.validator');
const validate = require('../../../middlewares/validate.middleware');
const asyncHandler = require('../../../middlewares/async.middleware');
const passport = require('passport');
const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');
const ERROR_CODES = require('../../../constants/error');

const router = express.Router();
const authController = new AuthController();

// Unsecured route
router.post(
  '/register',
  [userRegisterValidator(), validate],
  asyncHandler(authController.registerUser)
);
router.get(
  '/verify-email/:verificationToken',
  asyncHandler(authController.verifyEmail)
);
router.post(
  '/resend-email-verification',
  asyncHandler(authController.resendVerificationEmail)
);
router.post(
  '/login',
  [userLoginValidator(), validate],
  asyncHandler(authController.logIn)
);

// Secured routes
router.post('/logout', authentication, asyncHandler(authController.logOut));
router.get(
  '/refresh-token',
  authentication,
  asyncHandler(authController.refreshAccessToken)
);

// OAuth routes
const googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email'],
});
const googleAuthCallback = passport.authenticate('google', {
  session: false,
  failureRedirect: `${process.env.FRONTEND_URL}/error?code=${ERROR_CODES.AUTH.GOOGLE_LOGIN_FAILED}`,
});
const facebookAuth = passport.authenticate('facebook', { scope: 'email' });
const facebookAuthCallback = passport.authenticate('facebook', {
  session: false,
  failureRedirect: `${process.env.FRONTEND_URL}/error?code=${ERROR_CODES.AUTH.FACEBOOK_LOGIN_FAILED}`,
});

router.get('/google', googleAuth);
router.get(
  '/google/callback',
  googleAuthCallback,
  asyncHandler(authController.socialLogin)
);

router.get('/facebook', facebookAuth);
router.get(
  '/facebook/callback',
  facebookAuthCallback,
  asyncHandler(authController.socialLogin)
);

module.exports = router;
