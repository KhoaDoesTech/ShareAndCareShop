const RESPONSE_MESSAGES = require('../constants/responseMessages');

class SuccessResponse {
  constructor({ message, statusCode, reasonStatusCode, metadata = {} }) {
    this.message = message || reasonStatusCode;
    this.status = statusCode;
    this.metadata = metadata;
  }

  send(res) {
    return res.status(this.status).json(this);
  }
}

class ActionSuccess extends SuccessResponse {
  constructor({
    message,
    statusCode = RESPONSE_MESSAGES.ACTION_SUCCESS.status,
    reasonStatusCode = RESPONSE_MESSAGES.ACTION_SUCCESS.type,
    metadata,
  }) {
    super({ message, statusCode, reasonStatusCode, metadata });
  }
}

class CreateSuccess extends SuccessResponse {
  constructor({
    message,
    statusCode = RESPONSE_MESSAGES.CREATE_SUCCESS.status,
    reasonStatusCode = RESPONSE_MESSAGES.CREATE_SUCCESS.type,
    metadata,
  }) {
    super({ message, statusCode, reasonStatusCode, metadata });
  }
}

class NoContentSuccess extends SuccessResponse {
  constructor({
    message,
    statusCode = RESPONSE_MESSAGES.NO_CONTENT.status,
    reasonStatusCode = RESPONSE_MESSAGES.NO_CONTENT.type,
    metadata,
  }) {
    super({ message, statusCode, reasonStatusCode, metadata });
  }
}

module.exports = {
  SuccessResponse,
  NoContentSuccess,
  ActionSuccess,
  CreateSuccess,
};
