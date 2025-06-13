const WHITELIST_DOMAINS = require('../constants/whiteList');
const SERVER_CONFIG = require('./server.config');
const { ForbiddenError } = require('../utils/errorResponse');

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin && SERVER_CONFIG.env === 'development') {
      return callback(null, true);
    }

    if (SERVER_CONFIG.env === 'development') {
      return callback(null, true);
    }

    if (SERVER_CONFIG.env !== 'development') {
      return callback(null, true);
    }

    if (!origin) {
      return callback(null, true);
    }

    if (WHITELIST_DOMAINS.includes(origin)) {
      return callback(null, true);
    }

    return callback(
      new ForbiddenError(`${origin} not allowed by our CORS Policy.`)
    );
  },

  optionsSuccessStatus: 200,

  credentials: true,
};

module.exports = corsOptions;
