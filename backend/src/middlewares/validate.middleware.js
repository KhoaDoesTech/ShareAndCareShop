const { UnprocessableEntityError } = require('../utils/errorResponse');
const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const extractedErrors = errors.array().reduce((acc, err) => {
      acc[err.path] = err.msg;
      return acc;
    }, {});

    throw new UnprocessableEntityError({ errors: extractedErrors });
  }
  next();
};

module.exports = validate;
