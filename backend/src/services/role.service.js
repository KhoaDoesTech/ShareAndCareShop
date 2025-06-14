const { UserRoles, SortFieldRole } = require('../constants/status');
const RoleRepository = require('../repositories/role.repository');
const {
  BadRequestError,
  InternalServerError,
  ForbiddenError,
} = require('../utils/errorResponse');
const { convertToObjectIdMongodb } = require('../utils/helpers');

const PROTECTED_ROLES = [UserRoles.ADMIN, UserRoles.BASIC];

class RoleService {
  constructor() {
    this.roleRepository = new RoleRepository();
  }

  _flattenPermissions(permissions, prefix = '') {
    let result = [];
    for (const key in permissions) {
      if (typeof permissions[key] === 'object') {
        result = result.concat(
          this._flattenPermissions(permissions[key], `${prefix}${key}.`)
        );
      } else if (permissions[key] === true) {
        result.push(`${prefix}${key}`);
      }
    }
    return result;
  }

  _expandPermissions(permissions) {
    const result = {};
    permissions.forEach((perm) => {
      const keys = perm.split('.');
      keys.reduce((acc, key, index) => {
        if (index === keys.length - 1) {
          acc[key] = true;
        } else {
          acc[key] = acc[key] || {};
        }
        return acc[key];
      }, result);
    });
    return result;
  }

  async createRole({ name, permissions }) {
    const trimmedName = name.trim();
    const trimmedNameLower = trimmedName.toLowerCase();
    const protectedRolesLower = PROTECTED_ROLES.map((role) =>
      role.toLowerCase()
    );

    if (protectedRolesLower.includes(trimmedNameLower)) {
      throw new ForbiddenError(
        `Vai trò '${trimmedName}' là vai trò hệ thống và không thể tạo mới`
      );
    }

    const existingRole = await this.roleRepository.getByQuery({
      rol_name: trimmedName,
    });
    if (existingRole) {
      throw new BadRequestError('Tên vai trò đã tồn tại');
    }

    const newRole = await this.roleRepository.create({
      rol_name: name,
      rol_permissions: this._flattenPermissions(permissions),
    });

    if (!newRole) {
      throw new InternalServerError('Tạo vai trò thất bại');
    }

    return {
      id: newRole.id,
      name: newRole.name,
      permissions: this._expandPermissions(newRole.permissions),
    };
  }

  async getRoleById(roleId) {
    const foundRole = await this.roleRepository.getById(roleId);
    if (!foundRole) {
      throw new BadRequestError('Không tìm thấy vai trò');
    }

    return {
      id: foundRole.id,
      name: foundRole.name,
      permissions: this._expandPermissions(foundRole.permissions),
    };
  }

  async getAllRoles({ search, sort, page, size }) {
    const filter = {};
    if (search) {
      filter.rol_name = { $regex: search, $options: 'i' };
    }

    const mappedSort = sort
      ? `${sort.startsWith('-') ? '-' : ''}${
          SortFieldRole[sort.replace('-', '')] || 'createdAt'
        }`
      : '-createdAt';

    const query = {
      sort: mappedSort,
      page: parseInt(page),
      size: parseInt(size),
    };

    const roles = await this.roleRepository.getAll({
      filter,
      queryOptions: query,
    });

    const totalRoles = await this.roleRepository.countDocuments(filter);
    const totalPages = Math.ceil(totalRoles / size);

    return {
      totalRoles,
      totalPages,
      currentPage: page,
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
      })),
    };
  }

  async updateRole({ roleId, name, permissions }) {
    const foundRole = await this.roleRepository.getById(roleId);
    if (!foundRole) {
      throw new BadRequestError('Không tìm thấy vai trò');
    }

    if (PROTECTED_ROLES.includes(foundRole.rol_name)) {
      throw new ForbiddenError(
        `Vai trò '${foundRole.rol_name}' là vai trò hệ thống và không thể chỉnh sửa`
      );
    }

    const trimmedName = name.trim();
    const trimmedNameLower = trimmedName.toLowerCase();
    const protectedRolesLower = PROTECTED_ROLES.map((role) =>
      role.toLowerCase()
    );
    if (protectedRolesLower.includes(trimmedNameLower)) {
      throw new ForbiddenError(
        `Vai trò '${trimmedName}' là vai trò hệ thống và không thể chỉnh sửa`
      );
    }

    const existingRole = await this.roleRepository.getByQuery({
      rol_name: { $regex: name, $options: 'i' },
      _id: { $ne: convertToObjectIdMongodb(roleId) },
    });

    if (existingRole) {
      throw new BadRequestError('Tên vai trò đã tồn tại');
    }

    const updatedRole = await this.roleRepository.updateById(roleId, {
      rol_name: name,
      rol_permissions: this._flattenPermissions(permissions),
    });

    if (!updatedRole) {
      throw new InternalServerError('Cập nhật vai trò thất bại');
    }

    return {
      id: updatedRole.id,
      name: updatedRole.name,
      permissions: this._expandPermissions(updatedRole.permissions),
    };
  }

  async deleteRole(roleId) {
    console.log(roleId);
    const foundRole = await this.roleRepository.getById(roleId);
    if (!foundRole) {
      throw new BadRequestError('Không tìm thấy vai trò');
    }

    if (PROTECTED_ROLES.includes(foundRole.name)) {
      throw new ForbiddenError(
        `Vai trò '${foundRole.name}' là vai trò hệ thống và không thể xóa`
      );
    }

    const deletedRole = await this.roleRepository.deleteById(roleId);

    if (!deletedRole) {
      throw new InternalServerError('Xóa vai trò thất bại');
    }
  }
}

module.exports = RoleService;
