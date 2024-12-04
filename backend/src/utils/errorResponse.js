'use strict';

const RESPONSE_MESSAGES = require('../constants/responseMessages');

class ErrorResponse extends Error {
  constructor(message, statusCode) {
    super(message);
    this.status = statusCode;
  }
}

class BadRequestError extends ErrorResponse {
  constructor(
    message = RESPONSE_MESSAGES.BAD_REQUEST.type,
    statusCode = RESPONSE_MESSAGES.BAD_REQUEST.status
  ) {
    super(message, statusCode);
  }
}

class UnauthorizedError extends ErrorResponse {
  constructor(
    message = RESPONSE_MESSAGES.UNAUTHORIZED.type,
    statusCode = RESPONSE_MESSAGES.UNAUTHORIZED.status
  ) {
    super(message, statusCode);
  }
}

class EmailNotVerifiedError extends ErrorResponse {
  constructor(
    message = RESPONSE_MESSAGES.EMAIL_NOT_VERIFIED.type,
    metadata,
    statusCode = RESPONSE_MESSAGES.EMAIL_NOT_VERIFIED.status
  ) {
    super(message, statusCode);
    this.metadata = metadata;
  }
}

class TokenExpiredError extends ErrorResponse {
  constructor(
    message = RESPONSE_MESSAGES.TOKEN_EXPIRED.type,
    statusCode = RESPONSE_MESSAGES.TOKEN_EXPIRED.status
  ) {
    super(message, statusCode);
  }
}

class ForbiddenError extends ErrorResponse {
  constructor(
    message = RESPONSE_MESSAGES.FORBIDDEN.type,
    statusCode = RESPONSE_MESSAGES.FORBIDDEN.status
  ) {
    super(message, statusCode);
  }
}

class NotFoundError extends ErrorResponse {
  constructor(
    message = RESPONSE_MESSAGES.NOT_FOUND.type,
    statusCode = RESPONSE_MESSAGES.NOT_FOUND.status
  ) {
    super(message, statusCode);
  }
}

class AlreadyExistError extends ErrorResponse {
  constructor(
    message = RESPONSE_MESSAGES.ALREADY_EXIST.type,
    statusCode = RESPONSE_MESSAGES.ALREADY_EXIST.status
  ) {
    super(message, statusCode);
  }
}

class UnprocessableEntityError extends ErrorResponse {
  constructor({
    message = RESPONSE_MESSAGES.UNPROCESSABLE_ENTITY.type,
    statusCode = RESPONSE_MESSAGES.UNPROCESSABLE_ENTITY.status,
    errors = '',
  }) {
    super(message, statusCode);
    this.metadata = errors;
  }
}

class InternalServerError extends ErrorResponse {
  constructor(
    message = RESPONSE_MESSAGES.INTERNAL_ERROR.type,
    statusCode = RESPONSE_MESSAGES.INTERNAL_ERROR.status
  ) {
    super(message, statusCode);
  }
}

module.exports = {
  ErrorResponse,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  AlreadyExistError,
  InternalServerError,
  NotFoundError,
  UnprocessableEntityError,
  TokenExpiredError,
  EmailNotVerifiedError,
};
