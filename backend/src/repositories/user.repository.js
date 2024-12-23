const userModels = require('../models/user.model');
const BaseRepository = require('./base.repository');
const Role = require('../models/role.model');

class UserRepository extends BaseRepository {
  constructor() {
    super(userModels);
    this.model = userModels;
  }

  async getAdmin() {
    const foundAdmin = await this.model.aggregate([
      {
        $lookup: {
          from: 'Roles',
          localField: 'usr_role',
          foreignField: '_id',
          as: 'role',
        },
      },
      {
        $match: { 'role.rol_name': 'Admin' },
      },
    ]);

    return this.formatDocument(foundAdmin[0]);
  }

  formatDocument(user) {
    if (!user) return null;

    const formattedUser = {
      id: user._id,
      avatar: user.usr_avatar,
      name: user.usr_name,
      email: user.usr_email,
      password: user.usr_password,
      phone: user.usr_phone,
      role: user.usr_role.rol_name
        ? {
            id: user.usr_role._id,
            name: user.usr_role.rol_name,
            permissions: user.usr_role.rol_permissions,
          }
        : user.usr_role,
      loginType: user.usr_login_type,
      status: user.usr_status,
      failedLoginAttempts: user.failed_login_attempts,
      forgotPasswordToken: user.forgot_password_token,
      forgotPasswordExpiry: user.forgot_password_expiry,
      verificationToken: user.verification_token,
      verificationExpiry: user.verification_expiry,
    };

    return formattedUser;
  }
}

module.exports = UserRepository;
