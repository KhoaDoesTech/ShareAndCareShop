const { InternalServerError } = require('../utils/errorResponse');

const limiter = {
  windowMs: 15 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    return req.clientIp;
  },
  handler: (_, __, ___, options) => {
    throw new InternalServerError(
      `There are too many requests. You are only allowed ${
        options.max
      } requests per ${options.windowMs / 60000} minutes`
    );
  },
};

module.exports = limiter;
