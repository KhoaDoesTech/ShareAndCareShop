const CONFIG_PERMISSIONS = {
  ADMIN: 'ADMIN.GRANTED',
  BASIC: 'BASIC.PUBLIC',
  PAGE: {
    PANEL: 'PAGE.PANEL',
    DASHBOARD: 'PAGE.DASHBOARD',
  },
  MANAGE_PRODUCT: {
    PRODUCT: {
      CREATE: 'MANAGE_PRODUCT.PRODUCT.CREATE',
      VIEW: 'MANAGE_PRODUCT.PRODUCT.VIEW',
      UPDATE: 'MANAGE_PRODUCT.PRODUCT.UPDATE',
      DELETE: 'MANAGE_PRODUCT.PRODUCT.DELETE',
    },
    CATEGORY: {
      CREATE: 'MANAGE_PRODUCT.CATEGORY.CREATE',
      VIEW: 'MANAGE_PRODUCT.CATEGORY.VIEW',
      UPDATE: 'MANAGE_PRODUCT.CATEGORY.UPDATE',
      DELETE: 'MANAGE_PRODUCT.CATEGORY.DELETE',
    },
    SKU: {
      CREATE: 'MANAGE_PRODUCT.SKU.CREATE',
      VIEW: 'MANAGE_PRODUCT.SKU.VIEW',
      UPDATE: 'MANAGE_PRODUCT.SKU.UPDATE',
      DELETE: 'MANAGE_PRODUCT.SKU.DELETE',
    },
    UPLOAD: {
      CREATE: 'MANAGE_PRODUCT.UPLOAD.CREATE',
      DELETE: 'MANAGE_PRODUCT.UPLOAD.DELETE',
    },
    COUPON: {
      CREATE: 'MANAGE_PRODUCT.COUPON.CREATE',
      VIEW: 'MANAGE_PRODUCT.COUPON.VIEW',
      UPDATE: 'MANAGE_PRODUCT.COUPON.UPDATE',
      DELETE: 'MANAGE_PRODUCT.COUPON.DELETE',
    },
  },
  SYSTEM: {
    USER: {
      VIEW: 'SYSTEM.USER.VIEW',
      CREATE: 'SYSTEM.USER.CREATE',
      UPDATE: 'SYSTEM.USER.UPDATE',
      DELETE: 'SYSTEM.USER.DELETE',
    },
    ROLE: {
      VIEW: 'SYSTEM.ROLE.VIEW',
      CREATE: 'SYSTEM.ROLE.CREATE',
      UPDATE: 'SYSTEM.ROLE.UPDATE',
      DELETE: 'SYSTEM.ROLE.DELETE',
    },
  },
  MANAGE_ORDER: {
    REVIEW: {
      UPDATE: 'MANAGE_ORDER.REVIEW.UPDATE',
      DELETE: 'MANAGE_ORDER.REVIEW.DELETE',
    },
    ORDER: {
      VIEW: 'MANAGE_ORDER.ORDER.VIEW',
      CREATE: 'MANAGE_ORDER.ORDER.CREATE',
      UPDATE: 'MANAGE_ORDER.ORDER.UPDATE',
      DELETE: 'MANAGE_ORDER.ORDER.DELETE',
    },
  },
  SETTING: {
    PAYMENT_TYPE: {
      CREATE: 'SETTING.PAYMENT_TYPE.CREATE',
      UPDATE: 'SETTING.PAYMENT_TYPE.UPDATE',
      DELETE: 'SETTING.PAYMENT_TYPE.DELETE',
    },
    DELIVERY_TYPE: {
      CREATE: 'SETTING.DELIVERY_TYPE.CREATE',
      UPDATE: 'SETTING.DELIVERY_TYPE.UPDATE',
      DELETE: 'SETTING.DELIVERY_TYPE.DELETE',
    },
    CITY: {
      CREATE: 'CITY.CREATE',
      UPDATE: 'CITY.UPDATE',
      DELETE: 'CITY.DELETE',
    },
  },
};

module.exports = CONFIG_PERMISSIONS;
