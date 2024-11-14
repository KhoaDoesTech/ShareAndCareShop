const userModels = require('../models/user.model');
const BaseRepository = require('./base.repository');
const Role = require('../models/role.model');

class UserRepository extends BaseRepository {
  constructor() {
    super(userModels);
    this.model = userModels;
  }

  formatDocument(user) {
    if (!user) return null;

    const formattedUser = {
      id: user._id,
      avatar: user.usr_avatar,
      name: user.usr_name,
      email: user.usr_email,
      password: user.usr_password,
      role: user.usr_role.rol_name
        ? {
            id: user.usr_role._id,
            name: user.usr_role.rol_name,
            permissions: user.usr_role.rol_permissions,
          }
        : user.usr_role,
      loginType: user.usr_login_type,
      status: user.usr_status,
      publicKey: user.public_key,
      refreshToken: user.refresh_token,
      refreshTokensUsed: user.refresh_tokens_used,
      forgotPasswordToken: user.forgot_password_token,
      forgotPasswordExpiry: user.forgot_password_expiry,
      verificationToken: user.verification_token,
      verificationExpiry: user.verification_expiry,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return formattedUser;
  }
}

module.exports = UserRepository;
