// ======================= AUTH =======================
const UserLoginType = {
  GOOGLE: 'GOOGLE',
  GITHUB: 'GITHUB',
  FACEBOOK: 'FACEBOOK',
  EMAIL_PASSWORD: 'EMAIL_PASSWORD',
};
const AvailableSocialLogins = Object.values(UserLoginType);

// ======================= User =======================
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

const SortFieldUser = {
  CREATED_AT: 'createdAt',
  EMAIL: 'usr_email',
  NAME: 'usr_name',
};

// ======================= Product =======================
const ProductStatus = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  DELETED: 'DELETED',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  DISCONTINUED: 'DISCONTINUED',
};
const AvailableProductStatus = Object.values(ProductStatus);

const SELLABLE_STATUSES = new Set([
  ProductStatus.PUBLISHED,
  ProductStatus.OUT_OF_STOCK,
]);

const SortFieldProduct = {
  VIEWS: 'prd_views',
  PRICE: 'prd_price',
  QUANTITY: 'prd_quantity',
  SOLD: 'prd_sold',
  RATING: 'prd_rating',
  CREATED_AT: 'createdAt',
};

// ======================= Address =======================
const AddressType = {
  SHIPPING: 'SHIPPING',
  DEFAULT: 'DEFAULT',
};
const AvailableAddressTypes = Object.values(AddressType);

// ======================= Order & Cart =======================
const OrderStatus = {
  PENDING: 'PENDING', // Đơn hàng mới tạo (COD hoặc chưa thanh toán)
  AWAITING_PAYMENT: 'AWAITING_PAYMENT', // Chờ thanh toán (VNPay/MoMo)
  PROCESSING: 'PROCESSING', // Đang xử lý
  AWAITING_SHIPMENT: 'AWAITING_SHIPMENT', // Chờ vận chuyển
  SHIPPED: 'SHIPPED', // Đã vận chuyển
  DELIVERED: 'DELIVERED', // Đã giao
  CANCELLED: 'CANCELLED', // Đã hủy
  RETURN_REQUESTED: 'RETURN_REQUESTED', // Yêu cầu trả hàng
  RETURNED: 'RETURNED', // Đã trả hàng
  PENDING_REFUND: 'PENDING_REFUND', // Chờ hoàn tiền
  REFUNDED: 'REFUNDED', // Đã hoàn tiền
};
const AvailableOrderStatus = Object.values(OrderStatus);

const SortFieldOrder = {
  TOTAL_PRICE: 'ord_total_price',
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
};

const CartStatus = {
  LOCK: 'LOCK',
  FAIL: 'FAIL',
  ACTIVE: 'ACTIVE',
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
};
const AvailableCartStatus = Object.values(CartStatus);

// ======================= Payment =======================
const PaymentStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  PENDING_REFUND: 'PENDING_REFUND',
  REFUNDED: 'REFUNDED',
};
const AvailablePaymentStatuses = Object.values(PaymentStatus);

const PaymentMethod = {
  COD: 'COD',
  VNPAY: 'VNPAY',
  MOMO: 'MOMO',
};
const AvailablePaymentMethod = Object.values(PaymentMethod);

const PaymentGateway = {
  VNPAY: 'VNPAY',
  MOMO: 'MOMO',
};
const AvailablePaymentGateway = Object.values(PaymentGateway);

const PaymentType = {
  CASH: 'CASH',
  VNPAY: 'VNPAY',
  MOMO: 'MOMO',
  MANUAL: 'MANUAL',
};

const AvailablePaymentType = Object.values(PaymentType);

const PaymentSessionStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED',
};
const AvailablePaymentSessionStatus = Object.values(PaymentSessionStatus);

const RefundStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
};
const AvailableRefundStatus = Object.values(RefundStatus);

const TransactionType = {
  PAYMENT: 'PAYMENT', // Giao dịch thanh toán
  REFUND: 'REFUND', // Giao dịch hoàn tiền
  CASH_RECEIPT: 'CASH_RECEIPT', // Nhận tiền mặt
  CASH_REFUND: 'CASH_REFUND', // Hoàn tiền mặt
  MANUAL_REFUND: 'MANUAL_REFUND', // Hoàn tiền thủ công
};

const AvailableTransactionType = Object.values(TransactionType);

// ======================= Coupon & Attribute =======================
const CouponType = {
  PERCENT: 'PERCENT',
  AMOUNT: 'AMOUNT',
};
const AvailableCouponType = Object.values(CouponType);

const AttributeType = {
  TEXT: 'TEXT',
  COLOR: 'COLOR',
};
const AvailableAttributeTypes = Object.values(AttributeType);

const SortFieldAttribute = {
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
};

// ======================= COMMON ENUMS =======================
const Action = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
};
const AvailableActions = Object.values(Action);

const SortFieldRole = {
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  NAME: 'rol_name',
};

// ======================= Blog & Chat =======================
const BlogStatus = {
  INACTIVE: 'INACTIVE',
  ACTIVE: 'ACTIVE',
};
const AvailableBlogStatus = Object.values(BlogStatus);

const ChatRoles = {
  USER: 'user',
  AI: 'ai',
  ADMIN: 'admin',
};
const AvailableChatRoles = Object.values(ChatRoles);

// ======================= Return =======================
const RefundReason = {
  DEFECTIVE: 'DEFECTIVE', // Sản phẩm lỗi
  WRONG_ITEM: 'WRONG_ITEM', // Giao sai sản phẩm
  NOT_AS_DESCRIBED: 'NOT_AS_DESCRIBED', // Không đúng mô tả
  CHANGE_MIND: 'CHANGE_MIND', // Thay đổi ý định
  NOT_SUITABLE_SIZE: 'NOT_SUITABLE_SIZE', // Kích thước không phù hợp
  NOT_SUITABLE_STYLE: 'NOT_SUITABLE_STYLE', // Kiểu dáng không phù hợp
  BOM_HANG: 'BOM_HANG', // Khách từ chối nhận hàng
  CANCEL_ORDER: 'CANCEL_ORDER', // Hủy đơn hàng
  OTHER: 'OTHER', // Lý do khác
};
const AvailableRefundReasons = Object.values(RefundReason);

const SortFieldReview = {
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  STAR: 'rvw_star',
};

module.exports = {
  // Auth
  UserLoginType,
  AvailableSocialLogins,

  // User
  UserStatus,
  AvailableUserStatus,
  UserRoles,
  SortFieldUser,

  // Product
  ProductStatus,
  AvailableProductStatus,
  SELLABLE_STATUSES,
  SortFieldProduct,

  // Address
  AddressType,
  AvailableAddressTypes,

  // Order & Cart
  OrderStatus,
  AvailableOrderStatus,
  SortFieldOrder,
  CartStatus,
  AvailableCartStatus,

  // Payment
  PaymentStatus,
  AvailablePaymentStatuses,
  PaymentMethod,
  AvailablePaymentMethod,
  PaymentType,
  AvailablePaymentType,
  PaymentGateway,
  AvailablePaymentGateway,
  PaymentSessionStatus,
  AvailablePaymentSessionStatus,
  RefundStatus,
  AvailableRefundStatus,
  TransactionType,
  AvailableTransactionType,

  // Coupon & Attribute
  CouponType,
  AvailableCouponType,
  AttributeType,
  AvailableAttributeTypes,
  SortFieldAttribute,

  // Common
  Action,
  AvailableActions,
  SortFieldRole,

  // Blog & Chat
  BlogStatus,
  AvailableBlogStatus,
  ChatRoles,
  AvailableChatRoles,

  // Return
  RefundReason,
  AvailableRefundReasons,

  SortFieldReview,
};
