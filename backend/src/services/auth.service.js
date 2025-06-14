const { UserStatus, UserRoles } = require('../constants/status');
const {
  generateHashedPassword,
  generateTemporaryToken,
  hashToken,
  comparePassword,
} = require('../helpers/crypto.helper');
const EmailHelper = require('../helpers/email.helper');
const RoleRepository = require('../repositories/role.repository');
const userRepository = require('../repositories/user.repository');
const {
  InternalServerError,
  BadRequestError,
  AlreadyExistError,
  EmailNotVerifiedError,
} = require('../utils/errorResponse');
const { pickFields, removeLocalFile } = require('../utils/helpers');
const TokenService = require('./token.service');
const cloudinary = require('../helpers/cloudinary.helper');
const TokenRepository = require('../repositories/token.repository');

class AuthService {
  constructor() {
    this.userRepository = new userRepository();
    this.roleRepository = new RoleRepository();
    this.tokenRepository = new TokenRepository();
    this.EmailHelper = new EmailHelper();
    this.tokenService = new TokenService();
  }

  async registerUser({ email, username, password }) {
    const foundUser = await this.userRepository.getByQuery({
      usr_email: email,
    });

    if (foundUser) {
      if (foundUser.status === UserStatus.PENDING)
        throw new BadRequestError('Người dùng chưa xác thực email');

      if (foundUser.status === UserStatus.BLOCKED)
        throw new BadRequestError('Tài khoản đã bị khóa');

      throw new AlreadyExistError('Email hoặc tên đăng nhập đã tồn tại');
    }

    const { unHashedToken, hashedToken, tokenExpiry } =
      generateTemporaryToken();

    const passwordHash = await generateHashedPassword(password);

    const basicRole = await this.roleRepository.getByQuery({
      rol_name: UserRoles.BASIC,
    });

    if (!basicRole) throw new InternalServerError('Không tìm thấy vai trò');

    const newUser = await this.userRepository.create({
      usr_email: email,
      usr_password: passwordHash,
      usr_name: username,
      usr_role: basicRole.id,
      verification_token: hashedToken,
      verification_expiry: tokenExpiry,
    });

    if (!newUser)
      throw new InternalServerError('Đã xảy ra lỗi khi đăng ký người dùng');

    const verificationUrl = `${process.env.BACKEND_URL}/api/v1/auth/verify-email/${unHashedToken}`;

    await this.EmailHelper.sendVerificationEmail(
      username,
      email,
      verificationUrl
    );
    return {
      user: pickFields({
        fields: ['id', 'email', 'name'],
        object: newUser,
      }),
    };
  }

  async verifyEmail({ verificationToken }) {
    if (!verificationToken) throw new BadRequestError('Token không hợp lệ');

    // generate a hash from the token that we are receiving
    let hashedToken = hashToken(verificationToken);

    const foundUser = await this.userRepository.getByQuery({
      verification_token: hashedToken,
      verification_expiry: { $gte: Date.now() },
    });

    if (!foundUser)
      throw new BadRequestError('Token không hợp lệ hoặc đã hết hạn');

    const updatedUser = await this.userRepository.updateById(foundUser.id, {
      verification_token: null,
      verification_expiry: null,
      usr_status: UserStatus.ACTIVE,
    });

    if (!updatedUser) throw new InternalServerError('Xác thực email thất bại');

    return pickFields({
      fields: ['id', 'email', 'name'],
      object: updatedUser,
    });
  }

  async resendVerificationEmail({ username, email }) {
    const foundUser = await this.userRepository.getByQuery({
      usr_email: email,
    });

    if (!foundUser) throw new BadRequestError('Không tìm thấy người dùng');

    if (foundUser.status === UserStatus.BLOCKED)
      throw new BadRequestError('Tài khoản đã bị khóa');

    if (foundUser.status === UserStatus.ACTIVE)
      throw new BadRequestError('Tài khoản đã được xác thực');

    const { unHashedToken, hashedToken, tokenExpiry } =
      generateTemporaryToken();

    const updatedUser = await this.userRepository.updateById(foundUser.id, {
      verification_token: hashedToken,
      verification_expiry: tokenExpiry,
    });

    if (!updatedUser)
      throw new InternalServerError('Gửi lại email xác thực thất bại');

    const verificationUrl = `${process.env.BACKEND_URL}/api/v1/auth/verify-email/${unHashedToken}`;

    await this.EmailHelper.sendVerificationEmail(
      username,
      email,
      verificationUrl
    );

    return pickFields({
      fields: ['id', 'email'],
      object: updatedUser,
    });
  }

  async loginUser({ email, password, deviceToken, deviceName }) {
    const foundUser = await this.userRepository.getByQuery({
      usr_email: email,
    });

    this._checkUserStatus(foundUser);

    const isPasswordValid = await comparePassword(password, foundUser.password);

    if (!isPasswordValid)
      throw new BadRequestError('Email hoặc mật khẩu không đúng');

    const tokens = await this.tokenService.createTokensForDevice({
      user: foundUser,
      deviceToken,
      deviceName,
    });

    return {
      user: pickFields({
        fields: ['id', 'email', 'name', 'avatar'],
        object: foundUser,
      }),
      tokens,
    };
  }

  async socialLogin({
    password,
    avatar,
    email,
    username,
    loginType,
    deviceToken,
    deviceName,
  }) {
    let user = await this.userRepository.getByQuery({ usr_email: email });

    const basicRole = await this.roleRepository.getByQuery({
      rol_name: UserRoles.BASIC,
    });

    if (!basicRole) throw new InternalServerError('Không tìm thấy vai trò');

    if (!user) {
      user = await this.userRepository.create({
        usr_avatar: avatar,
        usr_email: email,
        usr_password: password,
        usr_name: username,
        usr_role: basicRole.id,
        usr_login_type: loginType,
        usr_status: UserStatus.ACTIVE,
      });
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new BadRequestError('Tài khoản đã bị khóa');
    }

    const tokens = await this.tokenService.createTokensForDevice({
      user,
      deviceToken,
      deviceName,
    });

    return {
      tokens,
      userId: user.id,
    };
  }

  async logoutUser({ userId, deviceToken }) {
    const deleteToken = await this.tokenRepository.deleteToken({
      userId: userId,
      deviceToken: deviceToken,
    });

    if (!deleteToken) throw new InternalServerError('Đăng xuất thất bại');
  }

  _checkUserStatus(foundUser) {
    if (!foundUser) throw new BadRequestError('Không tìm thấy người dùng');

    if (foundUser.status === UserStatus.PENDING) {
      throw new EmailNotVerifiedError('Người dùng chưa xác thực email', {
        email: foundUser.email,
        name: foundUser.name,
      });
    }

    if (foundUser.status === UserStatus.BLOCKED)
      throw new BadRequestError('Tài khoản đã bị khóa');
  }

  async forgotPasswordRequest({ email, isPanel }) {
    const foundUser = await this.userRepository.getByQuery({
      usr_email: email,
    });

    this._checkUserStatus(foundUser);

    const { unHashedToken, hashedToken, tokenExpiry } =
      generateTemporaryToken();

    const updatedUser = await this.userRepository.updateById(foundUser.id, {
      forgot_password_token: hashedToken,
      forgot_password_expiry: tokenExpiry,
    });

    if (!updatedUser)
      throw new InternalServerError('Yêu cầu đặt lại mật khẩu thất bại');

    let resetUrl = `${process.env.FRONTEND_URL}/reset-password/${unHashedToken}`;
    if (isPanel) {
      resetUrl = `${process.env.ADMIN_PANEL_URL}/reset-password/${unHashedToken}`;
    }

    await this.EmailHelper.sendForgotPasswordEmail(
      foundUser.name,
      email,
      resetUrl
    );
  }

  async resetForgottenPassword({ resetToken, newPassword }) {
    if (!resetToken) throw new BadRequestError('Token không hợp lệ');

    const hashedToken = hashToken(resetToken);

    const foundUser = await this.userRepository.getByQuery({
      forgot_password_token: hashedToken,
      forgot_password_expiry: { $gte: Date.now() },
    });

    const passwordHash = await generateHashedPassword(newPassword);

    const updatedUser = await this.userRepository.updateById(foundUser.id, {
      usr_password: passwordHash,
      forgot_password_token: null,
      forgot_password_expiry: null,
    });

    if (!updatedUser)
      throw new InternalServerError('Đặt lại mật khẩu thất bại');
  }

  async updateUserAvatar({ file, user }) {
    if (!file) {
      throw new BadRequestError('Vui lòng tải lên tệp ảnh');
    }

    try {
      const result = await cloudinary.uploader.upload(file.path, {
        public_id: `${user.id}`,
        folder: 'shareandcare/avatars',
        transformation: [
          { width: 1000, height: 1000, crop: 'thumb' },
          { quality: 'auto:eco', fetch_format: 'auto' },
        ],
      });

      const updatedUser = await this.userRepository.updateById(user.id, {
        usr_avatar: result.secure_url,
      });

      return {
        image_url: updatedUser.avatar,
      };
    } catch (error) {
      throw new InternalServerError('Tải ảnh đại diện thất bại');
    } finally {
      removeLocalFile(file.path);
    }
  }
}

module.exports = AuthService;
