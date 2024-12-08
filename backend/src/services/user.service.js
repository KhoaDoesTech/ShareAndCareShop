const { SortFieldUser, UserStatus } = require('../constants/status');
const {
  comparePassword,
  generateHashedPassword,
} = require('../helpers/crypto.helper');
const RoleRepository = require('../repositories/role.repository');
const UserRepository = require('../repositories/user.repository');
const { BadRequestError } = require('../utils/errorResponse');
const { pickFields } = require('../utils/helpers');

class UserService {
  constructor() {
    this.userRepository = new UserRepository();
    this.roleRepository = new RoleRepository();
  }

  async getAllUsers({ search, status, roleId, sort, page, size }) {
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

    return {
      users: users.map((user) =>
        pickFields({
          fields: ['id', 'name', 'email', 'status', 'role.name', 'role.id'],
          object: user,
        })
      ),
    };
  }

  async assignRoleToUser({ userId, roleId }) {
    const foundUser = await this.userRepository.getById(userId);
    if (!foundUser) {
      throw new BadRequestError('User not found');
    }

    const foundRole = await this.roleRepository.getById(roleId);
    if (!foundRole) {
      throw new BadRequestError('Role not found');
    }

    const updatedUser = await this.userRepository.updateById(userId, {
      usr_role: foundRole.id,
    });

    if (!updatedUser) {
      throw new BadRequestError('Failed to assign role to user');
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
      throw new BadRequestError('User not found');
    }

    const isMatch = await comparePassword(oldPassword, foundUser.password);
    if (!isMatch) {
      throw new BadRequestError('Old password is incorrect');
    }

    const updatedUser = await this.userRepository.updateById(userId, {
      usr_password: await generateHashedPassword(newPassword),
    });

    if (!updatedUser) {
      throw new BadRequestError('Failed to change password');
    }
  }

  async blockUser(userId) {
    const foundUser = await this.userRepository.getById(userId);
    if (!foundUser) {
      throw new BadRequestError('User not found');
    }

    const updatedUser = await this.userRepository.updateById(userId, {
      usr_status: UserStatus.BLOCKED,
    });

    if (!updatedUser) {
      throw new BadRequestError('Failed to block user');
    }

    return {
      id: updatedUser.id,
      status: updatedUser.status,
    };
  }

  async unblockUser(userId) {
    const foundUser = await this.userRepository.getById(userId);
    if (!foundUser) {
      throw new BadRequestError('User not found');
    }

    const updatedUser = await this.userRepository.updateById(userId, {
      usr_status: UserStatus.ACTIVE,
    });

    if (!updatedUser) {
      throw new BadRequestError('Failed to unblock user');
    }

    return {
      id: updatedUser.id,
      status: updatedUser.status,
    };
  }
}

module.exports = UserService;
