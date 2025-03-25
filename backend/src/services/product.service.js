'use strict';
const {
  ProductStatus,
  SortFieldProduct,
  SELLABLE_STATUSES,
} = require('../constants/status');
const AttributeRepository = require('../repositories/attribute.repository');
const AttributeValueRepository = require('../repositories/attributeValue.repository');
const CategoryRepository = require('../repositories/category.repository');
const ProductRepository = require('../repositories/product.repository');
const VariantRepository = require('../repositories/variant.repository');
const { BadRequestError } = require('../utils/errorResponse');
const {
  omitFields,
  removeUndefinedObject,
  updateNestedObjectParser,
  pickFields,
  convertToObjectIdMongodb,
  generateVariantSlug,
  listResponse,
} = require('../utils/helpers');
const UploadService = require('./upload.service');
const VariantService = require('./variant.service');

class ProductService {
  constructor() {
    this.productRepository = new ProductRepository();
    this.variantRepository = new VariantRepository();
    this.variantService = new VariantService();
    this.categoryRepository = new CategoryRepository();
    this.attributeRepository = new AttributeRepository();
    this.attributeValueRepository = new AttributeValueRepository();
    this.uploadService = new UploadService();
  }

  async createProduct({
    userId,
    name,
    video,
    returnDays,
    description,
    mainImage,
    subImages = [],
    originalPrice,
    category = [],
    attributes = [],
    variants = [],
    skuList = [],
  }) {
    // Generate productId
    const productId = `PRD_${Math.floor(Date.now() / 1000)}`;

    // Validate category and retrieve data
    const updatedCategories = await this._validateCategories(category);
    console.log(attributes);
    const updatedAttributes = await this._validateAttributes(attributes);

    // Calculate minPrice and maxPrice from skuList
    let minPrice, maxPrice;
    if (skuList.length) {
      const prices = skuList.map((sku) => sku.price);
      minPrice = Math.min(...prices);
      maxPrice = Math.max(...prices);
    } else {
      minPrice = originalPrice;
      maxPrice = originalPrice;
    }

    // Merge subImages with variant images
    const variantImages = variants.flatMap(({ images = [] }) => images);
    const updatedSubImages = Array.from(
      new Set([...subImages, ...variantImages])
    );

    const qrCodeUrl = await this.uploadService.uploadQRCode({
      text: `${process.env.FRONTEND_URL}/product/${productId}`,
    });

    const newProduct = await this.productRepository.create({
      prd_code: productId,
      prd_name: name,
      prd_main_image: mainImage,
      prd_sub_images: updatedSubImages,
      prd_qr_code: qrCodeUrl,
      prd_original_price: variants.length ? undefined : originalPrice,
      prd_min_price: minPrice,
      prd_max_price: maxPrice,
      prd_description: description,
      prd_category: updatedCategories,
      prd_attributes: updatedAttributes,
      prd_variants: variants
        ? variants.map((variant) => ({
            var_name: variant.name,
            var_images: variant.images,
            var_options: variant.options,
          }))
        : [],
      prd_video: video,
      return_days: returnDays,
      createdBy: userId,
      updatedBy: userId,
    });

    if (!newProduct) throw new BadRequestError('Failed to create product');

    const convertSkuList = skuList.map((sku, index) => ({
      prd_id: newProduct.id,
      prd_name: newProduct.name,
      var_tier_idx: sku.tierIndex,
      var_default: sku.isDefault,
      var_slug: generateVariantSlug(variants, sku.tierIndex),
      var_price: sku.price,
      createdBy: userId,
      updatedBy: userId,
    }));

    const variant = await this.variantRepository.create(convertSkuList);
    if (!variant) throw new BadRequestError('Failed to create variant');

    this.uploadService.deleteUsedImages([mainImage, ...subImages, qrCodeUrl]);

    return pickFields({
      fields: ['code'],
      object: newProduct,
    });
  }

  async _validateCategories(categories) {
    if (!categories || !categories.length) return [];

    const validCategories = [];
    await Promise.all(
      categories.map(async (id) => {
        const categoryData = await this.categoryRepository.getById(id);
        if (!categoryData) {
          throw new BadRequestError(`Category with ID ${id} not found`);
        }
        validCategories.push(categoryData);
      })
    );

    return validCategories.map((category) => ({
      id: category.id,
      name: category.name,
    }));
  }

  async _validateAttributes(attributes) {
    if (!Array.isArray(attributes) || attributes.length === 0) {
      throw new BadRequestError('Attributes must be a non-empty array.');
    }

    const attributeIds = attributes.map((attr) => attr.id);

    const attributeList = await this.attributeRepository.getAll({
      filter: { _id: { $in: attributeIds } },
    });

    const attributeMap = new Map(
      attributeList.map((attr) => [attr.id.toString(), attr])
    );

    const missingAttributes = attributeIds.filter(
      (id) => !attributeMap.has(id)
    );
    if (missingAttributes.length) {
      throw new BadRequestError(
        `Attributes not found: ${missingAttributes.join(', ')}`
      );
    }

    return attributes.map((attr) => {
      const attribute = attributeMap.get(attr.id);

      if (!Array.isArray(attr.values) || attr.values.length === 0) {
        throw new BadRequestError(
          `Values for attribute ${attr.id} must be a non-empty array.`
        );
      }

      const validValuesSet = new Set(
        attribute.values.map((v) => v.valueId.toString())
      );

      const validatedValues = attr.values.filter((val) =>
        validValuesSet.has(val)
      );
      const invalidValues = attr.values.filter(
        (val) => !validValuesSet.has(val)
      );

      if (invalidValues.length) {
        throw new BadRequestError(
          `Invalid values for attribute ${attr.id}: ${invalidValues.join(', ')}`
        );
      }

      return {
        id: attribute.id,
        values: validatedValues.map((val) => ({ id: val })),
      };
    });
  }

  async updateProduct({
    productKey,
    userId,
    name,
    video,
    returnDays,
    description,
    mainImage,
    subImages,
    originalPrice,
    discountType,
    discountValue,
    discountStart,
    discountEnd,
    category,
    attributes,
    variants,
    skuList,
    status,
  }) {
    const foundProduct = await this.productRepository.getProduct(productKey);
    if (!foundProduct) throw new BadRequestError('Product not found');

    let updatedAttributes = attributes
      ? await this._validateAttributes(attributes)
      : undefined;
    let updatedCategories = category
      ? await this._validateCategories(category)
      : undefined;
    let updatedVariants = variants
      ? variants.map((variant) => ({
          var_name: variant.name,
          var_options: variant.options,
          var_images: variant.images || [],
        }))
      : undefined;

    const currentSkus = await this.variantRepository.getVariantByFilter({
      prd_id: foundProduct.id,
    });

    let updatedSkuList = [];
    if (skuList && skuList.length > 0) {
      updatedSkuList = this._updateSkuList({
        currentSkus,
        skuList,
        foundProduct,
        userId,
        name,
      });
    } else if (name) {
      updatedSkuList = currentSkus.map((sku) => ({ ...sku, name }));
    }

    const prices = updatedSkuList
      .filter((sku) => SELLABLE_STATUSES.has(sku.status))
      .map((sku) => sku.price);
    let minPrice = prices.length ? Math.min(...prices) : foundProduct.minPrice;
    let maxPrice = prices.length ? Math.max(...prices) : foundProduct.maxPrice;

    let updatedSubImages = subImages
      ? Array.from(
          new Set([
            ...(subImages || foundProduct.subImages),
            ...updatedVariants.flatMap((v) => v.var_images || []),
          ])
        )
      : undefined;

    const updateData = removeUndefinedObject({
      prd_name: name,
      prd_description: description,
      prd_main_image: mainImage,
      prd_sub_images: updatedSubImages,
      prd_min_price: minPrice,
      prd_max_price: maxPrice,
      prd_original_price: originalPrice,
      prd_discount_type: discountType,
      prd_discount_value: discountValue,
      prd_discount_start: discountStart,
      prd_discount_end: discountEnd,
      prd_video: video,
      return_days: returnDays,
      prd_category: updatedCategories,
      prd_attributes: updatedAttributes,
      prd_variants: updatedVariants,
      prd_status: status,
      updatedBy: userId,
    });

    await this.productRepository.updateById(
      foundProduct.id,
      updateNestedObjectParser(updateData)
    );

    await Promise.all(updatedSkuList.map((sku) => this.upsertSku(sku)));

    return updateData;
  }

  async upsertSku(sku) {
    const existingSku = await this.variantRepository.findBySlug(
      sku.productId,
      sku.slug
    );
    const skuData = {
      prd_name: sku.name,
      var_price: sku.price,
      var_tier_idx: sku.tierIndex,
      var_status: sku.status,
      updatedBy: sku.updatedBy,
    };

    existingSku
      ? await this.variantRepository.updateById(existingSku.id, skuData)
      : await this.variantRepository.create({
          ...skuData,
          prd_id: sku.productId,
          var_slug: sku.slug,
          createdBy: sku.createdBy,
        });
  }

  _updateSkuList({ currentSkus, skuList, foundProduct, userId, name }) {
    const updatedSkuList = [];
    const existingSlugs = new Set();

    for (const newSku of skuList) {
      const existingSku = currentSkus.find((sku) => sku.slug === newSku.slug);

      const skuData = {
        name: name || foundProduct.name,
        price: newSku.price ?? existingSku?.price,
        status: newSku.status ?? existingSku?.status,
        tierIndex: newSku.tierIndex ?? existingSku?.tierIndex,
        updatedBy: userId,
        productId: foundProduct.id,
        slug: newSku.slug,
        createdBy: userId,
      };

      updatedSkuList.push(skuData);
      existingSlugs.add(newSku.slug);
    }

    for (const sku of currentSkus) {
      if (!existingSlugs.has(sku.slug)) {
        updatedSkuList.push({ ...sku, status: ProductStatus.DISCONTINUED });
      }
    }

    return updatedSkuList;
  }

  async getAllProductsPublic({
    search,
    category,
    minPrice,
    maxPrice,
    sort,
    page = 1,
    size = 10,
    attributes,
  }) {
    const filter = { prd_status: ProductStatus.PUBLISHED };
    const formatPage = parseInt(page);
    const formatSize = parseInt(size);

    // Search filter
    if (search) {
      const keyword = search.trim();
      const regexOptions = { $regex: keyword, $options: 'i' };

      filter.$or =
        keyword.length === 1
          ? [
              { prd_name: { $regex: `^${keyword}`, $options: 'i' } },
              { prd_description: regexOptions },
            ]
          : [{ prd_name: regexOptions }, { prd_description: regexOptions }];
    }

    // Category filter
    if (category) {
      filter.prd_category = {
        $elemMatch: { id: convertToObjectIdMongodb(category) },
      };
    }

    // Price filter
    if (minPrice || maxPrice) {
      filter.prd_price = {};
      if (minPrice) filter.prd_price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.prd_price.$lte = parseFloat(maxPrice);
    }

    if (attributes && attributes.length) {
      let parsedAttributes;
      try {
        parsedAttributes = JSON.parse(attributes);
      } catch (error) {
        parsedAttributes = attributes;
      }
      console.log(parsedAttributes);

      filter['$or'] = parsedAttributes.map((attr) => ({
        prd_attributes: {
          $elemMatch: {
            id: convertToObjectIdMongodb(attr.id),
            values: {
              $elemMatch: {
                id: {
                  $in: attr.values.map((val) => convertToObjectIdMongodb(val)),
                },
              },
            },
          },
        },
      }));
    }

    // Sort
    const mappedSort = sort
      ? `${sort.startsWith('-') ? '-' : ''}${
          SortFieldProduct[sort.replace('-', '')] || 'createdAt'
        }`
      : '-createdAt';

    const query = {
      sort: mappedSort,
      page: formatPage,
      size: formatSize,
    };

    // Fetch products
    const products = await this.productRepository.getAll({
      filter: filter,
      queryOptions: query,
      populateOptions: [
        { path: 'prd_attributes.id', model: 'Attribute' },
        { path: 'prd_attributes.values.id', model: 'AttributeValue' },
      ],
    });

    const totalProducts = await this.productRepository.countDocuments(filter);

    return listResponse({
      items: products.map((product) => {
        const priceInfo = this._calculateProductPrice(product);

        return {
          ...pickFields({
            fields: [
              'code',
              'name',
              'slug',
              'mainImage',
              'variants',
              'rating',
              'ratingCount',
            ],
            object: product,
          }),
          variantAttributes: this._formatAttributes(
            product.attributes.filter((attr) => attr.isVariant)
          ),
          price: priceInfo.price,
          discountedPrice: priceInfo.discountedPrice,
          hasDiscount: priceInfo.hasDiscount,
        };
      }),
      total: totalProducts,
      page: formatPage,
      size: formatSize,
    });
  }

  _formatAttributes(attributes) {
    return attributes.map((attr) => ({
      type: attr.type,
      name: attr.name,
      values: attr.values.map((val) => ({
        value: val.value,
        descriptionUrl: val.descriptionUrl,
      })),
    }));
  }

  _calculateProductPrice(product) {
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
          min: this._calculateDiscountedValue(
            price.min,
            discountType,
            discountValue
          ),
          max: this._calculateDiscountedValue(
            price.max,
            discountType,
            discountValue
          ),
        };
      } else {
        discountedPrice = this._calculateDiscountedValue(
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
  }

  _calculateDiscountedValue(price, discountType, discountValue) {
    let finalPrice = price;
    if (discountType === 'AMOUNT') {
      finalPrice = price - discountValue;
    } else if (discountType === 'PERCENT') {
      finalPrice = price * (1 - discountValue / 100);
    }
    return Math.max(0, finalPrice);
  }

  async getAllProducts({
    search,
    category,
    minPrice,
    maxPrice,
    sort,
    page = 1,
    size = 10,
    attributes,
  }) {
    const filter = {};
    const formatPage = parseInt(page);
    const formatSize = parseInt(size);

    if (search) {
      const keyword = search.trim();
      const regexOptions = { $regex: keyword, $options: 'i' };

      filter.$or =
        keyword.length === 1
          ? [
              { prd_name: { $regex: `^${keyword}`, $options: 'i' } },
              { prd_description: regexOptions },
            ]
          : [{ prd_name: regexOptions }, { prd_description: regexOptions }];
    }

    if (category) {
      filter.prd_category = {
        $elemMatch: { id: convertToObjectIdMongodb(category) },
      };
    }

    if (minPrice || maxPrice) {
      filter.prd_price = {};
      if (minPrice) filter.prd_price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.prd_price.$lte = parseFloat(maxPrice);
    }

    if (attributes && attributes.length) {
      filter.prd_attributes = { $in: attributes };
    }

    const mappedSort = sort
      ? `${sort.startsWith('-') ? '-' : ''}${
          SortFieldProduct[sort.replace('-', '')] || 'createdAt'
        }`
      : '-createdAt';

    const query = {
      sort: mappedSort,
      page: formatPage,
      size: formatSize,
    };

    const products = await this.productRepository.getAll({
      filter: filter,
      queryOptions: query,
    });

    const totalProducts = await this.productRepository.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / size);

    return {
      totalPages,
      totalProducts,
      currentPage: formatPage,
      products: products.map((product) =>
        omitFields({
          fields: [
            'subImages',
            'category',
            'attributes',
            'description',
            'createdAt',
            'updatedAt',
          ],
          object: product,
        })
      ),
    };
  }

  async deleteProduct({ productId }) {
    const deletedProduct = await this.productRepository.deleteById(productId);

    if (!deletedProduct) {
      throw new BadRequestError('Product not found');
    }

    await this.variantService.deleteVariants(productId);

    // this.uploadService.deleteUsedImage(
    //   deletedProduct.mainImage,
    //   deletedProduct.subImages
    // );
  }

  // async getProductDetailsPublic({ productId }) {
  //   const foundProduct = await this.productRepository.getByQuery({
  //     _id: productId,
  //     prd_status: ProductStatus.PUBLISHED,
  //   });

  //   if (!foundProduct) {
  //     throw new BadRequestError('Product not found');
  //   }

  //   const skuList = await this.variantService.getPublicVariantByProductId(
  //     productId
  //   );

  //   this._updateProductViews(productId);

  //   return {
  //     product: omitFields({
  //       fields: [
  //         'views',
  //         'uniqueViews',
  //         'createdAt',
  //         'updatedAt',
  //         'sold',
  //         'status',
  //       ],
  //       object: foundProduct,
  //     }),
  //     skuList,
  //   };
  // }

  async getProductDetailsPublic({ productKey }) {
    const foundProduct = await this.productRepository.getProductsPublished(
      productKey
    );

    if (!foundProduct) {
      throw new BadRequestError('Product not found');
    }

    const skuList = await this.variantService.getPublicVariantByProductId(
      foundProduct.id
    );

    this._updateProductViews(foundProduct.id);

    const priceInfo = this._calculateProductPrice(foundProduct);

    return {
      product: {
        ...pickFields({
          fields: [
            'code',
            'name',
            'slug',
            'mainImage',
            'subImages',
            'qrCode',
            'description',
            'video',
            'returnDays',
            'variants',
            'rating',
            'ratingCount',
          ],
          object: foundProduct,
        }),
        attributes: this._formatAttributes(
          foundProduct.attributes.filter((attr) => !attr.isVariant)
        ),
        variantAttributes: this._formatAttributes(
          foundProduct.attributes.filter((attr) => attr.isVariant)
        ),
        price: priceInfo.price,
        discountedPrice: priceInfo.discountedPrice,
        hasDiscount: priceInfo.hasDiscount,
      },
      skuList,
    };
  }

  _updateProductViews(productId) {
    const updatedProduct = this.productRepository.updateById(productId, {
      $inc: { prd_views: 1 },
    });

    if (!updatedProduct) {
      throw new BadRequestError('Product not found');
    }
  }

  async updateProductUniqueViews({ productId, deviceId }) {
    const updatedProduct = await this.productRepository.updateById(productId, {
      $addToSet: { prd_unique_views: deviceId },
    });

    if (!updatedProduct) {
      throw new BadRequestError('Failed to update product views');
    }
  }

  // async getProductDetails({ productId }) {
  //   const foundProduct = await this.productRepository.getById(productId);

  //   if (!foundProduct) {
  //     throw new BadRequestError('Product not found');
  //   }

  //   const skuList = await this.variantService.getVariantByProductId(productId);

  //   return {
  //     product: omitFields({
  //       fields: ['createdAt', 'updatedAt'],
  //       object: foundProduct,
  //     }),
  //     skuList,
  //   };
  // }

  async getProductDetails({ productKey }) {
    const foundProduct = await this.productRepository.getProduct(productKey);

    if (!foundProduct) {
      throw new BadRequestError('Product not found');
    }

    const skuList = await this.variantService.getVariantByProductId(
      foundProduct.id
    );

    this._updateProductViews(foundProduct.id);

    const priceInfo = this._calculateProductPrice(foundProduct);

    return {
      product: {
        ...omitFields({
          fields: ['createdAt', 'updatedAt'],
          object: foundProduct,
        }),
        attributes: this._formatAttributes(
          foundProduct.attributes.filter((attr) => !attr.isVariant)
        ),
        variantAttributes: this._formatAttributes(
          foundProduct.attributes.filter((attr) => attr.isVariant)
        ),
        price: priceInfo.price,
        discountedPrice: priceInfo.discountedPrice,
        hasDiscount: priceInfo.hasDiscount,
      },
      skuList,
    };
  }

  async publishProduct({ productId }) {
    const foundProduct = await this.productRepository.getById(productId);

    if (!foundProduct) {
      throw new BadRequestError('Product not found');
    }

    const updatedProduct = await this.productRepository.updateById(productId, {
      prd_status: ProductStatus.PUBLISHED,
    });

    await this.variantService.publicAllVariants(productId);

    return pickFields({
      fields: ['status', 'updatedAt'],
      object: updatedProduct,
    });
  }

  async unpublishProduct({ productId }) {
    const foundProduct = await this.productRepository.getById(productId);

    if (!foundProduct) {
      throw new BadRequestError('Product not found');
    }

    const updatedProduct = await this.productRepository.updateById(productId, {
      prd_status: ProductStatus.DISCONTINUED,
    });

    return pickFields({
      fields: ['status', 'updatedAt'],
      object: updatedProduct,
    });
  }

  async updateProductQuantity({ id, quantity = null, skuList }) {
    const foundProduct = await this.productRepository.getById(id);
    if (!foundProduct) throw new NotFoundError('Product not found');

    // Handle product without variants
    if (foundProduct.variants && foundProduct.variants.length > 0) {
      if (!skuList || skuList.length === 0) {
        throw new BadRequestError(
          'This product has variants. Please update quantities via skuList.'
        );
      }
      return this._handleProductWithVariants({
        product: foundProduct,
        skuList,
      });
    }

    if (quantity) {
      return this._handleProductWithoutVariants({
        product: foundProduct,
        quantity,
      });
    }

    throw new BadRequestError(
      'Invalid request: quantity or skuList must be provided'
    );
  }

  async _handleProductWithoutVariants({ product, quantity }) {
    const totalQuantity = quantity + product.quantity;
    const status =
      totalQuantity === 0
        ? ProductStatus.OUT_OF_STOCK
        : ProductStatus.PUBLISHED;

    const updatedProduct = await this.productRepository.updateById(product.id, {
      prd_quantity: totalQuantity,
      prd_status: status,
    });

    return {
      id: updatedProduct.id,
      name: updatedProduct.name,
      quantity: updatedProduct.quantity,
      status: updatedProduct.status,
    };
  }

  async _handleProductWithVariants({ product, skuList }) {
    await this.variantService.updateVariantQuantities(skuList);

    const totalQuantity =
      await this.variantService._calculateTotalVariantQuantity(product.id);

    const status =
      totalQuantity === 0
        ? ProductStatus.OUT_OF_STOCK
        : ProductStatus.PUBLISHED;

    const updatedProduct = await this.productRepository.updateById(product.id, {
      prd_quantity: totalQuantity,
      prd_status: status,
    });

    return {
      id: updatedProduct.id,
      name: updatedProduct.name,
      quantity: updatedProduct.quantity,
      status: updatedProduct.status,
    };
  }
}

module.exports = ProductService;
