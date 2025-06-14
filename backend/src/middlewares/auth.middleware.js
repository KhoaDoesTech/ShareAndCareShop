const HEADERS = require('../constants/headers');
const asyncHandler = require('./async.middleware');
const {
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} = require('../utils/errorResponse');
const UserRepository = require('../repositories/user.repository');
const CONFIG_PERMISSIONS = require('../constants/permissions');
const { UserStatus } = require('../constants/status');
const { validateToken, getFromHeaders } = require('../helpers/auth.helper');
const { parseJwt } = require('../utils/helpers');
const TokenRepository = require('../repositories/token.repository');

const authentication = asyncHandler(async (req, res, next) => {
  // Extract required headers
  const clientId = getFromHeaders(req, HEADERS.CLIENT_ID);
  const accessToken = req.headers[HEADERS.AUTHORIZATION];
  const refreshToken = req.headers[HEADERS.REFRESH_TOKEN];

  // Decode the token and validate userId
  const decodedToken = parseJwt(accessToken || refreshToken);
  if (!decodedToken.userId) throw new BadRequestError('Yêu cầu không hợp lệ');

  const userId = clientId === decodedToken.userId ? decodedToken.userId : null;
  if (!userId) throw new BadRequestError('Yêu cầu không hợp lệ');

  // Fetch the token details
  const tokenRepository = new TokenRepository();
  const keyStore = await tokenRepository.getToken({
    userId,
    deviceToken: decodedToken.deviceToken,
  });

  if (!keyStore) throw new BadRequestError('Không tìm thấy tài nguyên');

  // Fetch the user details
  const userRepository = new UserRepository();
  const foundUser = await userRepository.getByQuery(
    {
      _id: userId,
      usr_status: UserStatus.ACTIVE,
    },
    {
      path: 'usr_role',
      select: 'rol_name rol_permissions',
    }
  );
  if (!foundUser) throw new NotFoundError('Không tìm thấy người dùng');

  // Handle refresh token scenario
  if (refreshToken) {
    await _handleRefreshToken(refreshToken, keyStore, userId, tokenRepository);
    await validateToken(refreshToken, keyStore.publicKey, userId);

    req.user = foundUser;
    req.keyStore = keyStore;

    return next();
  }

  // Handle access token scenario
  if (!accessToken) throw new BadRequestError('Yêu cầu không hợp lệ');

  await validateToken(accessToken, keyStore.publicKey, userId);

  req.user = foundUser;
  req.keyStore = keyStore;

  next();
});

const verifyPermission = (permissions) =>
  asyncHandler(async (req, res, next) => {
    const { user } = req;

    if (!user) throw new UnauthorizedError('Bạn chưa được xác thực');

    const hasPermission =
      permissions.includes(user.role.permissions) ||
      user?.role?.permissions?.includes(CONFIG_PERMISSIONS.ADMIN);

    if (!hasPermission)
      throw new ForbiddenError('Bạn không có quyền thực hiện hành động này');

    return next();
  });

const _handleRefreshToken = async (
  refreshToken,
  keyStore,
  userId,
  tokenRepository
) => {
  if (keyStore.refreshTokensUsed.includes(refreshToken)) {
    await tokenRepository.deleteToken({
      userId,
      deviceToken: keyStore.deviceToken,
    });

    throw new ForbiddenError('Có lỗi xảy ra! Vui lòng đăng nhập lại');
  }

  await validateToken(refreshToken, keyStore.publicKey, userId, true);
};

module.exports = {
  authentication,
  verifyPermission,
};
