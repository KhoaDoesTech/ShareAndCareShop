const roleModels = require('../models/role.model');
const BaseRepository = require('./base.repository');

class RoleRepository extends BaseRepository {
  constructor() {
    super(roleModels);
    this.model = roleModels;
  }

  formatDocument(role) {
    if (!role) return null;
    return {
      id: role._id,
      name: role.rol_name,
      permissions: role.rol_permissions,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}

module.exports = RoleRepository;
