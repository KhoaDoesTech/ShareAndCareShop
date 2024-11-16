const CONFIG_PERMISSIONS = require('../constants/permissions');
const { UserStatus, UserLoginType, UserRoles } = require('../constants/status');
const { generateHashedPassword } = require('../helpers/crypto.helper');
const mongoose = require('mongoose');

const productModel = require('../models/product.model');
const profileModel = require('../models/profile.model');
const variantModel = require('../models/variant.model');

const RoleRepository = require('../repositories/role.repository');
const UserRepository = require('../repositories/user.repository');

class DataInitializer {
  constructor() {
    this.roleRepository = new RoleRepository();
    this.userRepository = new UserRepository();
  }

  async initializeRoles() {
    const adminRole = await this.roleRepository.create({
      rol_name: UserRoles.ADMIN,
      rol_permissions: [CONFIG_PERMISSIONS.ADMIN],
    });

    const basicRole = await this.roleRepository.create({
      rol_name: UserRoles.BASIC,
      rol_permissions: [CONFIG_PERMISSIONS.BASIC],
    });

    return { adminRole, basicRole };
  }

  async initializeAdminUser(adminRole) {
    const hashPassword = await generateHashedPassword('ShareAnCare2024');

    const adminUser = await this.userRepository.create({
      usr_email: 'admin@gmail.com',
      usr_name: 'admin',
      usr_password: hashPassword,
      usr_role: adminRole.id,
      usr_status: UserStatus.ACTIVE,
      usr_login_type: UserLoginType.EMAIL_PASSWORD,
    });

    return adminUser;
  }

  async initializeData() {
    const { adminRole } = await this.initializeRoles();

    if (!adminRole) {
      throw new Error('Role Admin not found');
    }

    await this.initializeAdminUser(adminRole);
  }

  async destroyData() {
    const collections = Object.keys(mongoose.connection.collections);

    console.log(collections);
    for (const collectionName of collections) {
      const collection = mongoose.connection.collections[collectionName];
      await collection.deleteMany({});
    }
  }
}

module.exports = DataInitializer;
