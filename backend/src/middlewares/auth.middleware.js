const HEADERS = require('../constants/headers');
const asyncHandler = require('./async.middleware');
const {
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
} = require('../utils/errorResponse');
const UserRepository = require('../repositories/user.repository');
const CONFIG_PERMISSIONS = require('../constants/permissions');
const { UserStatus } = require('../constants/status');
const { validateToken, getFromHeaders } = require('../helpers/auth.helper');

const authentication = asyncHandler(async (req, res, next) => {
  const userId = getFromHeaders(req, HEADERS.CLIENT_ID);
  console.log(userId);
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
  if (!foundUser) throw new NotFoundError('Not found User');

  if (req.headers[HEADERS.REFRESH_TOKEN]) {
    const refreshToken = getFromHeaders(req, HEADERS.REFRESH_TOKEN);

    if (foundUser.refreshTokensUsed.includes(refreshToken)) {
      await userRepository.updateById(foundUser.id, {
        refresh_token: null,
        public_key: null,
      });

      throw new ForbiddenError('Something wrong happened! Please relogin');
    }

    await validateToken(refreshToken, foundUser, userId);
    req.user = foundUser;
    req.refreshToken = refreshToken;

    return next();
  }

  const accessToken = getFromHeaders(req, HEADERS.AUTHORIZATION);

  await validateToken(accessToken, foundUser, userId);
  req.user = foundUser;
  next();
});

const verifyPermission = (permissions) =>
  asyncHandler(async (req, res, next) => {
    const { user } = req;

    if (!user) throw new UnauthorizedError('Unauthorized request');

    const hasPermission =
      permissions.includes(user.role.permissions) ||
      user?.role?.permissions?.includes(CONFIG_PERMISSIONS.ADMIN);

    if (!hasPermission)
      throw new ForbiddenError('You are not allowed to perform this action');

    return next();
  });

module.exports = {
  authentication,
  verifyPermission,
};
