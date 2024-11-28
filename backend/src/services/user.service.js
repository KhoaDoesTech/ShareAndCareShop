const { SortFieldUser } = require('../constants/status');
const ProfileRepository = require('../repositories/profile.repository');
const UserRepository = require('../repositories/user.repository');
const { pickFields } = require('../utils/helpers');

class UserService {
  constructor() {
    this.userRepository = new UserRepository();
    this.profileRepository = new ProfileRepository();
  }

  async getAllUsers({ search, status, roleId, sort, page, size }) {
    let userFilter = {};
    if (search) {
      const profilesWithPhone = await this.profileRepository.getAll({
        filter: { prof_phone: { $regex: search, $options: 'i' } },
      });

      const profileUserIds = profilesWithPhone.map((profile) => profile.userId);

      userFilter = {
        $or: [
          { usr_name: { $regex: search, $options: 'i' } },
          { usr_email: { $regex: search, $options: 'i' } },
          { _id: { $in: profileUserIds } },
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
    console.log(users);

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
