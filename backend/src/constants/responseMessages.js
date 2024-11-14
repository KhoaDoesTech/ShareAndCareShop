const RESPONSE_MESSAGES = {
  ACTION_SUCCESS: {
    type: 'SUCCESS',
    status: 200,
  },
  CREATE_SUCCESS: {
    type: 'SUCCESS',
    status: 201,
  },
  NO_CONTENT: {
    type: 'NO_CONTENT',
    status: 204,
  },
  BAD_REQUEST: {
    type: 'BAD_REQUEST',
    status: 400,
  },
  UNAUTHORIZED: {
    type: 'UNAUTHORIZED',
    status: 401,
  },
  FORBIDDEN: {
    type: 'FORBIDDEN',
    status: 403,
  },
  NOT_FOUND: {
    type: 'NOT_FOUND',
    status: 404,
  },
  ALREADY_EXIST: {
    type: 'ALREADY_EXIST',
    status: 409,
  },
  UNPROCESSABLE_ENTITY: {
    type: 'UNPROCESSABLE_ENTITY',
    status: 422,
  },
  INTERNAL_ERROR: {
    type: 'INTERNAL_SERVER_ERROR',
    status: 500,
  },
};

module.exports = RESPONSE_MESSAGES;
