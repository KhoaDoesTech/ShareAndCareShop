const ERROR_CODES = {
  AUTH: {
    GOOGLE_LOGIN_FAILED: '1001',
    FACEBOOK_LOGIN_FAILED: '1002',
    GENERAL_AUTH_FAILED: '1003',
  },
  USER: {
    USER_NOT_FOUND: '2001',
    INVALID_PASSWORD: '2002',
    ACCOUNT_LOCKED: '2003',
  },
  DATABASE: {
    CONNECTION_FAILED: '3001',
    TIMEOUT: '3002',
  },
};

module.exports = ERROR_CODES;
