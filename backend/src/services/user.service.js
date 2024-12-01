const { SortFieldUser } = require('../constants/status');
const UserRepository = require('../repositories/user.repository');
const { pickFields } = require('../utils/helpers');

class UserService {
  constructor() {
    this.userRepository = new UserRepository();
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
          fields: ['id', 'name', 'email', 'status', 'role.name'],
          object: user,
        })
      ),
    };
  }
}

module.exports = UserService;
