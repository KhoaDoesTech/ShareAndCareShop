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
  calculateProductPrice,
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
      prd_return_days: returnDays,
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

    let updatedVariants = variants?.map((variant) => ({
      var_name: variant.name,
      var_options: variant.options,
      var_images: variant.images || [],
    }));

    const currentSkus = await this.variantRepository.getVariantByFilter({
      prd_id: foundProduct.id,
    });

    let updatedSkuList = [];
    if (skuList?.length > 0) {
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
    const minPrice = prices.length
      ? Math.min(...prices)
      : foundProduct.minPrice;
    const maxPrice = prices.length
      ? Math.max(...prices)
      : foundProduct.maxPrice;

    const variantsSource = updatedVariants || foundProduct.variants;
    const variantImages = variantsSource.flatMap(
      (v) => v.var_images || v.images || []
    );
    const baseSubImages =
      subImages !== undefined ? subImages : foundProduct.subImages || [];

    const updatedSubImages = Array.from(
      new Set([...baseSubImages, ...variantImages])
    );

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
      prd_return_days: returnDays,
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

    if (updatedSkuList.length > 0) {
      await Promise.all(updatedSkuList.map((sku) => this._upsertSku(sku)));
    }

    return updateData;
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
    const formatPage = parseInt(page);
    const formatSize = parseInt(size);

    // Build filter for public products
    const filter = this._buildProductFilter({
      search,
      category,
      minPrice,
      maxPrice,
      attributes,
      status: ProductStatus.PUBLISHED,
    });

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

    // Fetch products with optimized population
    const products = await this.productRepository.getAll({
      filter,
      queryOptions: query,
      populateOptions: [
        { path: 'prd_attributes.id', model: 'Attribute' },
        { path: 'prd_attributes.values.id', model: 'AttributeValue' },
      ],
    });

    const totalProducts = await this.productRepository.countDocuments(filter);

    return listResponse({
      items: products.map((product) => {
        const priceInfo = calculateProductPrice(product);
        return {
          ...pickFields({
            fields: [
              'id',
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
    const formatPage = parseInt(page);
    const formatSize = parseInt(size);

    // Build filter without status restriction
    const filter = this._buildProductFilter({
      search,
      category,
      minPrice,
      maxPrice,
      attributes,
    });

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

    // Fetch products without population
    const products = await this.productRepository.getAll({
      filter,
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

  async getProductDetailsPublic({ productKey }) {
    const productFilter = { prd_status: ProductStatus.PUBLISHED };
    const foundProduct = await this.productRepository.getProductsInfo(
      productKey,
      productFilter
    );

    if (!foundProduct) {
      throw new BadRequestError('Product not found');
    }

    const skuList = await this.variantService.getPublicVariantByProductId(
      foundProduct.id
    );

    this._updateProductViews(foundProduct.id);

    const priceInfo = calculateProductPrice(foundProduct);

    return {
      product: {
        ...pickFields({
          fields: [
            'id',
            'code',
            'name',
            'slug',
            'mainImage',
            'subImages',
            'qrCode',
            'description',
            'video',
            'category',
            'variants',
            'quantity',
            'returnDays',
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

  async getProductDetails({ productKey }) {
    const productFilter = {};
    const foundProduct = await this.productRepository.getProductsInfo(
      productKey,
      productFilter
    );

    if (!foundProduct) {
      throw new BadRequestError('Product not found');
    }

    const skuList = await this.variantService.getVariantByProductId(
      foundProduct.id
    );

    const priceInfo = calculateProductPrice(foundProduct);

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

  async publishProduct({ productKey }) {
    const foundProduct = await this.productRepository.getProduct(productKey);

    if (!foundProduct) {
      throw new BadRequestError('Product not found');
    }

    const updatedProduct = await this.productRepository.updateById(
      foundProduct.id,
      {
        prd_status: ProductStatus.PUBLISHED,
      }
    );

    await this.variantService.publicAllVariants(foundProduct.id);

    return pickFields({
      fields: ['status', 'updatedAt'],
      object: updatedProduct,
    });
  }

  async unpublishProduct({ productKey }) {
    const foundProduct = await this.productRepository.getProduct(productKey);

    if (!foundProduct) {
      throw new BadRequestError('Product not found');
    }

    const updatedProduct = await this.productRepository.updateById(
      foundProduct.id,
      {
        prd_status: ProductStatus.DISCONTINUED,
      }
    );

    await this.variantService.unPublicAllVariants(foundProduct.id);

    return pickFields({
      fields: ['status', 'updatedAt'],
      object: updatedProduct,
    });
  }

  async importStock({ items, userId }) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestError('Items array is required and cannot be empty');
    }

    if (!userId) {
      throw new BadRequestError('User ID is required');
    }

    const updatedData = [];

    for (const item of items) {
      const { productId, variantId, quantity } = item;

      if (!productId || quantity === undefined || quantity <= 0) {
        throw new BadRequestError(
          `Invalid item: productId and quantity (>0) are required`
        );
      }

      const foundProduct = await this.productRepository.getById(productId);
      if (!foundProduct) {
        throw new NotFoundError(`Product ${productId} not found`);
      }

      let updateData = { updatedBy: userId };

      if (variantId) {
        const variant = await this.variantRepository.getById(variantId);
        if (!variant || variant.productId.toString() !== productId.toString()) {
          throw new NotFoundError(
            `Variant ${variantId} not found or does not belong to product ${productId}`
          );
        }

        const updatedVariant = await this.variantRepository.updateById(
          variantId,
          {
            $inc: { var_quantity: quantity },
            updatedBy: userId,
          }
        );

        if (
          updatedVariant.status === ProductStatus.OUT_OF_STOCK &&
          updatedVariant.quantity > 0
        ) {
          await this.variantRepository.updateById(variantId, {
            var_status: ProductStatus.PUBLISHED,
            updatedBy: userId,
          });
          updatedVariant.status = ProductStatus.PUBLISHED;
        }

        if (foundProduct.variants.length > 0) {
          const variants = await this.variantRepository.getVariantByFilter({
            prd_id: productId,
          });
          const totalQuantity = variants.reduce(
            (sum, v) => sum + v.quantity,
            0
          );

          updateData = {
            ...updateData,
            prd_quantity: totalQuantity,
          };

          if (
            foundProduct.status === ProductStatus.OUT_OF_STOCK &&
            totalQuantity > 0
          ) {
            updateData.prd_status = ProductStatus.PUBLISHED;
          }
        }

        updatedData.push({
          productId: foundProduct.id,
          variantId: variant.id,
          quantity: updatedVariant.quantity,
          productQuantity: updateData.prd_quantity || foundProduct.quantity,
          status: updatedVariant.status,
        });
      } else {
        if (foundProduct.variants.length > 0) {
          throw new BadRequestError(
            `Product ${productId} has variants; variantId is required`
          );
        }

        const newQuantity = foundProduct.quantity + quantity;
        updateData = {
          ...updateData,
          prd_quantity: newQuantity,
          prd_status:
            newQuantity === 0
              ? ProductStatus.OUT_OF_STOCK
              : ProductStatus.PUBLISHED,
        };

        updatedData.push({
          productId: foundProduct.id,
          variantId: null,
          quantity: newQuantity,
          productQuantity: newQuantity,
          status: updateData.prd_status || foundProduct.status,
        });
      }

      await this.productRepository.updateById(
        foundProduct.id,
        updateNestedObjectParser(removeUndefinedObject(updateData))
      );
    }

    return {
      updatedItems: updatedData.map((item) =>
        pickFields({
          fields: [
            'productId',
            'variantId',
            'quantity',
            'productQuantity',
            'status',
          ],
          object: item,
        })
      ),
    };
  }

  async applyDiscounts({ items, userId }) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestError('Items array is required and cannot be empty');
    }

    if (!userId) {
      throw new BadRequestError('User ID is required');
    }

    const updatedData = [];

    for (const item of items) {
      const {
        productId,
        discountType,
        discountValue,
        discountStart,
        discountEnd,
      } = item;

      // Validate input
      if (
        !productId ||
        !discountType ||
        discountValue === undefined ||
        !discountStart ||
        !discountEnd
      ) {
        throw new BadRequestError(
          `Invalid item: productId, discountType, discountValue, discountStart, and discountEnd are required`
        );
      }

      if (!['AMOUNT', 'PERCENT'].includes(discountType)) {
        throw new BadRequestError(
          `Invalid discountType: must be AMOUNT or PERCENT`
        );
      }

      if (discountValue < 0) {
        throw new BadRequestError(`discountValue must be non-negative`);
      }

      const startDate = new Date(discountStart);
      const endDate = new Date(discountEnd);
      if (isNaN(startDate) || isNaN(endDate)) {
        throw new BadRequestError(`Invalid discountStart or discountEnd date`);
      }

      if (startDate >= endDate) {
        throw new BadRequestError(`discountStart must be before discountEnd`);
      }

      // Fetch product
      const foundProduct = await this.productRepository.getById(productId);
      if (!foundProduct) {
        throw new NotFoundError(`Product ${productId} not found`);
      }

      // Prepare update data
      const updateData = removeUndefinedObject({
        discountType,
        discountValue,
        discountStart: startDate,
        discountEnd: endDate,
        updatedBy: userId,
      });

      // Update product
      await this.productRepository.updateById(
        foundProduct.id,
        updateNestedObjectParser(updateData)
      );

      updatedData.push({
        productId: foundProduct.id,
        discountType,
        discountValue,
        discountStart: startDate,
        discountEnd: endDate,
      });
    }

    return {
      updatedItems: updatedData.map((item) =>
        pickFields({
          fields: [
            'productId',
            'discountType',
            'discountValue',
            'discountStart',
            'discountEnd',
          ],
          object: item,
        })
      ),
    };
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
    const attributeList = await this._fetchAttributes(attributeIds);
    this._validateAttributeIds(attributeIds, attributeList);

    return this._buildValidatedAttributes(attributes, attributeList);
  }

  async _fetchAttributes(attributeIds) {
    const attributeList = await this.attributeRepository.getAll({
      filter: { _id: { $in: attributeIds } },
    });
    return new Map(attributeList.map((attr) => [attr.id.toString(), attr]));
  }

  _validateAttributeIds(attributeIds, attributeMap) {
    const missingAttributes = attributeIds.filter(
      (id) => !attributeMap.has(id)
    );
    if (missingAttributes.length) {
      throw new BadRequestError(
        `Attributes not found: ${missingAttributes.join(', ')}`
      );
    }
  }

  _buildValidatedAttributes(attributes, attributeMap) {
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

  _buildProductFilter({
    search,
    category,
    minPrice,
    maxPrice,
    attributes,
    status,
  }) {
    const filter = status ? { prd_status: status } : {};

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
      filter.$or = [
        {
          prd_min_price: {
            $gte: parseFloat(minPrice || 0),
            $lte: parseFloat(maxPrice || Infinity),
          },
        },
        {
          prd_max_price: {
            $gte: parseFloat(minPrice || 0),
            $lte: parseFloat(maxPrice || Infinity),
          },
        },
      ];
    }

    if (attributes) {
      const parsedAttributes = this._parseAttributes(attributes);
      filter.$or = this._buildAttributeFilter(parsedAttributes);
    }

    return filter;
  }

  _parseAttributes(attributes) {
    if (attributes == null || attributes === '') {
      return []; // Skip filtering if attributes are null or empty
    }

    let parsedAttributes;

    // Handle single object by wrapping in array
    if (typeof attributes === 'object' && !Array.isArray(attributes)) {
      parsedAttributes = [attributes];
    } else if (typeof attributes === 'string') {
      try {
        parsedAttributes = JSON.parse(attributes);
        // Ensure parsed result is an array
        if (!Array.isArray(parsedAttributes)) {
          parsedAttributes = [parsedAttributes];
        }
      } catch (error) {
        throw new BadRequestError(
          'Invalid attributes format: must be valid JSON'
        );
      }
    } else if (Array.isArray(attributes)) {
      parsedAttributes = attributes;
    } else {
      throw new BadRequestError(
        'Attributes must be a string, array, or object'
      );
    }

    if (!parsedAttributes.length) {
      return []; // Skip filtering if empty array
    }

    // Validate attribute structure
    parsedAttributes.forEach((attr, index) => {
      if (
        !attr ||
        !attr.id ||
        !Array.isArray(attr.values) ||
        !attr.values.length
      ) {
        throw new BadRequestError(
          `Invalid attribute at index ${index}: must have id and non-empty values array`
        );
      }
      attr.values.forEach((val, valIdx) => {
        if (!val) {
          throw new BadRequestError(
            `Invalid value at index ${valIdx} for attribute ${attr.id}`
          );
        }
      });
    });

    return parsedAttributes;
  }

  _buildAttributeFilter(attributes) {
    return attributes.map((attr) => ({
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

  async _upsertSku(sku) {
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

  _formatAttributes(attributes, requestedAttributeIds = null) {
    const filteredAttributes = requestedAttributeIds
      ? attributes.filter((attr) =>
          requestedAttributeIds.includes(attr.id.toString())
        )
      : attributes;

    return filteredAttributes.map((attr) => ({
      type: attr.type,
      name: attr.name,
      values: attr.values.map((val) => ({
        value: val.value,
        descriptionUrl: val.descriptionUrl,
      })),
    }));
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
