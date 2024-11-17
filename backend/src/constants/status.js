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

const SortField = {
  VIEWS: 'prd_views',
  PRICE: 'prd_price',
  QUANTITY: 'prd_quantity',
  SOLD: 'prd_sold',
  RATING: 'prd_rating',
  CREATED_AT: 'createdAt',
};

//
const AddressType = {
  SHIPPING: 'SHIPPING',
  BILLING: 'BILLING',
  DEFAULT: 'DEFAULT',
  NONE: 'NONE',
};

const AvailableAddressTypes = Object.values(AddressType);

const OrderStatus = {
  PENDING: 'PENDING', // Đơn hàng đã tạo nhưng chưa xác nhận
  AWAITING_PAYMENT: 'AWAITING_PAYMENT', // Chờ thanh toán
  PROCESSING: 'PROCESSING', // Đang xử lý đơn hàng
  AWAITING_SHIPMENT: 'AWAITING_SHIPMENT', // Chờ vận chuyển
  SHIPPED: 'SHIPPED', // Đã vận chuyển
  DELIVERED: 'DELIVERED', // Đã giao
  CANCELLED: 'CANCELLED', // Đã hủy
  RETURNED: 'RETURNED', // Đã trả hàng
};

const AvailableOrderStatus = Object.values(OrderStatus);

const CartStatus = {
  LOCK: 'LOCK',
  FAIL: 'FAIL',
  ACTIVE: 'ACTIVE',
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
};

const AvailableCartStatus = Object.values(CartStatus);

const PaymentMethod = {
  COD: 'COD',
  VN_PAY: 'VN_PAY',
};

const AvailablePaymentMethod = Object.values(PaymentMethod);

const CouponType = {
  PERCENT: 'PERCENT',
  AMOUNT: 'AMOUNT',
};

const AvailableCouponType = Object.values(CouponType);

module.exports = {
  UserLoginType,
  AvailableSocialLogins,
  UserStatus,
  AvailableUserStatus,
  UserRoles,
  ProductStatus,
  AvailableProductStatus,
  OrderStatus,
  AvailableOrderStatus,
  AddressType,
  AvailableAddressTypes,
  CartStatus,
  AvailableCartStatus,
  PaymentMethod,
  AvailablePaymentMethod,
  CouponType,
  AvailableCouponType,
  SortField,
};
