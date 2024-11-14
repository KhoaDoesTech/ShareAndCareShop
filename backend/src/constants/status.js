const UserLoginType = {
  GOOGLE: 'GOOGLE',
  GITHUB: 'GITHUB',
  FACEBOOK: 'FACEBOOK',
  EMAIL_PASSWORD: 'EMAIL_PASSWORD',
};

const AvailableSocialLogins = Object.values(UserLoginType);

const UserStatus = {
  ACTIVE: 'ACTIVE',
  PENDING: 'PENDING',
  BLOCKED: 'BLOCKED',
};

const AvailableUserStatus = Object.values(UserStatus);

const UserRoles = {
  ADMIN: 'Admin',
  BASIC: 'Basic',
};

//
const ProductStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  DELETED: 'DELETED',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  DISCONTINUED: 'DISCONTINUED',
};

const AvailableProductStatus = Object.values(ProductStatus);

module.exports = {
  UserLoginType,
  AvailableSocialLogins,
  UserStatus,
  AvailableUserStatus,
  UserRoles,
  ProductStatus,
  AvailableProductStatus,
};
