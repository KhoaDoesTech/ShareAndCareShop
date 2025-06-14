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
      `Quá nhiều yêu cầu. Bạn chỉ được phép gửi tối đa ${
        options.max
      } yêu cầu trong mỗi ${options.windowMs / 60000} phút`
    );
  },
};

module.exports = limiter;
