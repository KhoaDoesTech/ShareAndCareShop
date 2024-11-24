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
const upload = require('../../../middlewares/multer.middleware');
const router = express.Router();

// Middleware for setting sessio
const setSessionData = (req, res, next) => {
  req.session.deviceToken = req.query.deviceToken;
  req.session.deviceName = req.query.deviceName;
  req.session.isPanel = req.query.isPanel;

  next();
};

// Unsecured route
router.post(
  '/register',
  [userRegisterValidator(), validate],
  asyncHandler(AuthController.registerUser)
);
router.get(
  '/verify-email/:verificationToken',
  asyncHandler(AuthController.verifyEmail)
);
router.post(
  '/resend-email-verification',
  asyncHandler(AuthController.resendVerificationEmail)
);
router.post(
  '/login',
  [userLoginValidator(), validate],
  asyncHandler(AuthController.logIn)
);
router.get(
  '/admin-panel',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.PAGE.PANEL),
  asyncHandler(AuthController.panelLogin)
);

router.post('/forgot-password', asyncHandler(AuthController.forgotPassword));
router.post('/reset-password', asyncHandler(AuthController.resetPassword));

// Secured routes
router.post('/logout', authentication, asyncHandler(AuthController.logOut));
router.patch(
  '/avatar',
  authentication,
  upload.single('avatar'),
  asyncHandler(AuthController.updateUserAvatar)
);

// OAuth configurations
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

// Google OAuth routes
router.get('/google', setSessionData, googleAuth);
router.get(
  '/google/callback',
  googleAuthCallback,
  asyncHandler(AuthController.socialLogin)
);

// Facebook OAuth routes
router.get('/facebook', setSessionData, facebookAuth);
router.get(
  '/facebook/callback',
  facebookAuthCallback,
  asyncHandler(AuthController.socialLogin)
);

module.exports = router;
