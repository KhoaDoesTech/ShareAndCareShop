const { body, param } = require('express-validator');

const userRegisterValidator = () => {
  return [
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Email is invalid'),
    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 3 })
      .withMessage('Username must be at lease 3 characters long'),
    body('password').trim().notEmpty().withMessage('Password is required'),
  ];
};

const userLoginValidator = () => {
  return [
    body('email').optional().isEmail().withMessage('Email is invalid'),
    body('username').optional(),
    body('password').notEmpty().withMessage('Password is required'),
  ];
};

module.exports = {
  userRegisterValidator,
  userLoginValidator,
};
