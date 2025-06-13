'use strict';

const fs = require('fs');
const logger = require('../helpers/logger.helper');
const { Types } = require('mongoose');
const _ = require('lodash');

const convertToObjectIdMongodb = (id) => new Types.ObjectId(id);

const pickFields = ({ fields = [], object = {} }) => {
  return _.pick(object, fields);
};

const omitFields = ({ fields = [], object = {} }) => {
  return _.omit(object, fields);
};

const parseJwt = (token) => {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
};

const getRandomNumber = (max) => {
  return Math.floor(Math.random() * max);
};

const generateVariantSlug = (variants, tierIndex) => {
  return tierIndex
    .map((index, i) => (variants[i] ? variants[i].options[index] : ''))
    .join('/');
};

const removeLocalFile = (localPath) => {
  fs.unlink(localPath, (err) => {
    if (err) logger.error('Error while removing local files: ', err);
    else {
      logger.info('Removed local: ', localPath);
    }
  });
};

const extractPublicIdFromUrl = (url) => {
  if (!url) return null;
  const parts = url.split('/');
  const publicId = parts.slice(-3).join('/').split('.')[0];

  return publicId;
};

const removeUndefinedObject = (object) => {
  Object.keys(object).forEach((key) => {
    if (object[key] === undefined || object[key] === null) delete object[key];
  });

  return object;
};

const updateNestedObjectParser = (obj) => {
  const final = {};
  Object.keys(obj).forEach((i) => {
    if (typeof obj[i] === 'object' && !Array.isArray(obj[i])) {
      const response = updateNestedObjectParser(obj[i]);
      Object.keys(obj[i]).forEach((j) => {
        final[`${i}.${j}`] = response[j];
      });
    } else {
      final[i] = obj[i];
    }
  });

  return final;
};

const getVariantImagesFromTierIndex = (variants, tierIndex) => {
  if (!variants || !tierIndex) return [];
  return tierIndex
    .map((idx, level) => variants[level]?.var_images?.[idx] || null)
    .filter(Boolean);
};

const getVariantImageOrDefault = (variants, tierIndex, mainImage) => {
  if (!Array.isArray(variants) || !tierIndex || tierIndex.length === 0)
    return mainImage;

  let selectedImage = mainImage;

  variants.forEach((variant, index) => {
    const selectedIndex = tierIndex[index];

    if (
      selectedIndex !== undefined &&
      variant.var_images &&
      variant.var_images[selectedIndex]
    ) {
      selectedImage = variant.var_images[selectedIndex];
    }
  });

  return selectedImage;
};

const sortObject = (obj) => {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, '+');
  }
  return sorted;
};

const sortObjectV2 = (obj) => {
  const sortedKeys = Object.keys(obj).sort();
  const result = {};
  sortedKeys.forEach((key) => {
    result[key] = obj[key]; // không encode ở đây!
  });
  return result;
};

const buildQueryString = (obj) => {
  return Object.entries(obj)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value).replace(
          /%20/g,
          '+'
        )}`
    )
    .join('&');
};

const listResponse = ({ items, total, page, size }) => {
  const totalPages = Math.ceil(total / size);
  const hasMore = page < totalPages;

  return {
    total,
    totalPages,
    page,
    size,
    hasMore,
    items,
  };
};

const calculateProductPrice = (product) => {
  const {
    originalPrice,
    minPrice,
    maxPrice,
    discountType,
    discountValue,
    discountStart,
    discountEnd,
    variants,
  } = product;

  const hasVariants = variants && variants.length > 0;

  let price;
  if (hasVariants) {
    if (minPrice === maxPrice) {
      price = minPrice;
    } else {
      price = { min: minPrice, max: maxPrice };
    }
  } else {
    price = originalPrice;
  }

  const now = new Date();
  const isDiscountActive =
    discountStart != null &&
    discountEnd != null &&
    now >= new Date(discountStart) &&
    now <= new Date(discountEnd);

  let discountedPrice = null;
  if (isDiscountActive && discountValue > 0) {
    if (typeof price === 'object') {
      discountedPrice = {
        min: calculateDiscountedValue(price.min, discountType, discountValue),
        max: calculateDiscountedValue(price.max, discountType, discountValue),
      };
    } else {
      discountedPrice = calculateDiscountedValue(
        price,
        discountType,
        discountValue
      );
    }
  }

  return {
    price,
    discountedPrice,
    hasDiscount: isDiscountActive && discountValue > 0,
  };
};

const calculateDiscountedValue = (price, discountType, discountValue) => {
  let finalPrice = price;
  if (discountType === CouponType.AMOUNT) {
    finalPrice = price - discountValue;
  } else if (discountType === CouponType.PERCENT) {
    finalPrice = price * (1 - discountValue / 100);
  }
  return Math.max(0, finalPrice);
};

module.exports = {
  convertToObjectIdMongodb,
  getRandomNumber,
  pickFields,
  omitFields,
  generateVariantSlug,
  removeLocalFile,
  removeUndefinedObject,
  updateNestedObjectParser,
  extractPublicIdFromUrl,
  getVariantImagesFromTierIndex,
  getVariantImageOrDefault,
  parseJwt,
  sortObject,
  sortObjectV2,
  listResponse,
  calculateProductPrice,
  calculateDiscountedValue,
  buildQueryString,
};
