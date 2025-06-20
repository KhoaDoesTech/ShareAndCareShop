const { SortFieldUser, UserStatus } = require('../constants/status');
const {
  comparePassword,
  generateHashedPassword,
} = require('../helpers/crypto.helper');
const RoleRepository = require('../repositories/role.repository');
const UserRepository = require('../repositories/user.repository');
const { BadRequestError } = require('../utils/errorResponse');
const { pickFields, listResponse } = require('../utils/helpers');

class UserService {
  constructor() {
    this.userRepository = new UserRepository();
    this.roleRepository = new RoleRepository();
  }

  async getAllUsers({ search, status, roleId, sort, page = 1, size = 10 }) {
    let userFilter = {};
    if (search) {
      userFilter = {
        $or: [
          { usr_name: { $regex: search, $options: 'i' } },
          { usr_phone: { $regex: search, $options: 'i' } },
          { usr_email: { $regex: search, $options: 'i' } },
        ],
      };
    }

    if (status) {
      userFilter.usr_status = status;
    }

    if (roleId) {
      userFilter.usr_role = roleId;
    }

    const mappedSort = sort
      ? `${sort.startsWith('-') ? '-' : ''}${
          SortFieldUser[sort.replace('-', '').toUpperCase()] || 'createdAt'
        }`
      : '-createdAt';

    const queryOptions = {
      sort: mappedSort,
      page: parseInt(page),
      size: parseInt(size),
    };

    const populateOptions = {
      path: 'usr_role',
      select: 'rol_name rol_permissions',
    };

    const users = await this.userRepository.getAll({
      filter: userFilter,
      queryOptions,
      populateOptions,
    });

    const totalUsers = await this.userRepository.countDocuments(userFilter);

    return listResponse({
      items: users.map((user) =>
        pickFields({
          fields: ['id', 'name', 'email', 'status', 'role.name', 'role.id'],
          object: user,
        })
      ),
      total: totalUsers,
      page: page,
      size: size,
    });
  }

  async assignRoleToUser({ userId, roleId }) {
    const foundUser = await this.userRepository.getById(userId);
    if (!foundUser) {
      throw new BadRequestError('Không tìm thấy người dùng');
    }

    const foundRole = await this.roleRepository.getById(roleId);
    if (!foundRole) {
      throw new BadRequestError('Không tìm thấy vai trò');
    }

    const updatedUser = await this.userRepository.updateById(userId, {
      usr_role: foundRole.id,
    });

    if (!updatedUser) {
      throw new BadRequestError('Phân quyền cho người dùng thất bại');
    }

    return {
      id: updatedUser.id,
      role: {
        id: foundRole.id,
        name: foundRole.name,
      },
    };
  }

  async changePassword({ userId, oldPassword, newPassword }) {
    const foundUser = await this.userRepository.getById(userId);
    if (!foundUser) {
      throw new BadRequestError('Không tìm thấy người dùng');
    }

    const isMatch = await comparePassword(oldPassword, foundUser.password);
    if (!isMatch) {
      throw new BadRequestError('Mật khẩu cũ không đúng');
    }

    const updatedUser = await this.userRepository.updateById(userId, {
      usr_password: await generateHashedPassword(newPassword),
    });

    if (!updatedUser) {
      throw new BadRequestError('Đổi mật khẩu thất bại');
    }
  }

  async blockUser(userId) {
    const foundUser = await this.userRepository.getById(userId);
    if (!foundUser) {
      throw new BadRequestError('Không tìm thấy người dùng');
    }

    const updatedUser = await this.userRepository.updateById(userId, {
      usr_status: UserStatus.BLOCKED,
    });

    if (!updatedUser) {
      throw new BadRequestError('Khóa người dùng thất bại');
    }

    return {
      id: updatedUser.id,
      status: updatedUser.status,
    };
  }

  async unblockUser(userId) {
    const foundUser = await this.userRepository.getById(userId);
    if (!foundUser) {
      throw new BadRequestError('Không tìm thấy người dùng');
    }

    const updatedUser = await this.userRepository.updateById(userId, {
      usr_status: UserStatus.ACTIVE,
    });

    if (!updatedUser) {
      throw new BadRequestError('Mở khóa người dùng thất bại');
    }

    return {
      id: updatedUser.id,
      status: updatedUser.status,
    };
  }
}

module.exports = UserService;
