const CONFIG_PERMISSIONS = require('../constants/permissions');
const {
  UserStatus,
  UserLoginType,
  UserRoles,
  AddressType,
} = require('../constants/status');
const { generateHashedPassword } = require('../helpers/crypto.helper');
const mongoose = require('mongoose');

// const productModel = require('../models/product.model');
// const variantModel = require('../models/variant.model');
const cartModel = require('../models/cart.model');
// const categoryModel = require('../models/category.model');
const orderModel = require('../models/order.model');
const roleModel = require('../models/role.model');
const userModel = require('../models/user.model');
const addressModel = require('../models/address.model');
// const couponModel = require('../models/coupon.model');
// const deliveryModel = require('../models/delivery.model');
const tokenModel = require('../models/token.model');

const RoleRepository = require('../repositories/role.repository');
const UserRepository = require('../repositories/user.repository');
const AddressRepository = require('../repositories/address.repository');

class DataInitializer {
  constructor() {
    this.roleRepository = new RoleRepository();
    this.userRepository = new UserRepository();
    this.addressRepository = new AddressRepository();
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
    const hashPassword = await generateHashedPassword('ShareAndCare2024');

    // Step 1: Create the admin user
    const adminUser = await this.userRepository.create({
      usr_email: 'shareandcaret@gmail.com',
      usr_name: 'Share And Care Admin',
      usr_phone: '0812056724',
      usr_password: hashPassword,
      usr_role: adminRole.id,
      usr_status: UserStatus.ACTIVE,
      usr_login_type: UserLoginType.EMAIL_PASSWORD,
    });

    // Step 2: Initialize admin address
    await this.addressRepository.create({
      usr_id: adminUser.id,
      usr_name: 'ShareAndCare Admin',
      usr_phone: '0812056724',
      adr_place_id:
        'iSozub-guZV6smhesmxS8UWyBEa9oYvTQ4x7V5uh7FlyoDRR7AWb2m2KNB6SWaracbA8UJVascpEcXw1rYup0UMERROgbJySd3VFUZNjk_qzVdlYFpQWDk3ShXi6TBOjT',
      adr_street: 'Đại Học Sư Phạm Kỹ Thuật HCMUTE, 1 Võ Văn Ngân',
      adr_ward: 'Linh Chiểu',
      adr_district: 'Thủ Đức',
      adr_city: 'Hồ Chí Minh',
      adr_location: {
        lat: 10.8499603271484,
        lng: 106.77155303955,
      },
      adr_type: AddressType.DEFAULT,
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
