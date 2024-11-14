'use strict';

const SERVER_CONFIG = require('../configs/server.config');
const RESPONSE_MESSAGES = require('../constants/responseMessages');

const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || RESPONSE_MESSAGES.INTERNAL_ERROR.status;

  const responseError = {
    code: statusCode,
    message: err.message,
    stack: err.stack,
    metadata: err.metadata,
  };

  if (SERVER_CONFIG.env !== 'development') delete responseError.stack;

  res.status(responseError.code).json(responseError);
};

module.exports = errorHandler;
