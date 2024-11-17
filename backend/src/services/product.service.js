const { ProductStatus, SortField } = require('../constants/status');
const CategoryRepository = require('../repositories/category.repository');
const ProductRepository = require('../repositories/product.repository');
const { BadRequestError } = require('../utils/errorResponse');
const {
  omitFields,
  removeUndefinedObject,
  updateNestedObjectParser,
} = require('../utils/helpers');
const VariantService = require('./variant.service');

class ProductService {
  constructor() {
    this.productRepository = new ProductRepository();
    this.variantService = new VariantService();
    this.categoryRepository = new CategoryRepository();
  }

  async createProduct({
    name,
    mainImage,
    subImages = [],
    price,
    originalPrice,
    quantity,
    description,
    category = [],
    attributes = [],
    variants = [],
    skuList = [],
  }) {
    // Validate category and retrieve data
    await Promise.all(
      category.map(async ({ id }) => {
        const categoryData = await this.categoryRepository.getById(id);
        if (!categoryData) {
          throw new BadRequestError(`Category with id ${id} not found`);
        }
        return categoryData;
      })
    );

    // Calculate total quantity
    const totalQuantity = skuList.length
      ? skuList.reduce((total, { quantity }) => total + quantity, 0)
      : quantity;

    // Merge subImages with variant images
    const variantImages = variants.flatMap(({ images = [] }) => images);
    const updatedSubImages = Array.from(
      new Set([...subImages, ...variantImages])
    );

    const newProduct = await this.productRepository.create({
      prd_name: name,
      prd_main_image: mainImage,
      prd_sub_images: updatedSubImages,
      prd_price: price,
      prd_original_price: originalPrice,
      prd_quantity: totalQuantity,
      prd_description: description,
      prd_category: category,
      prd_attributes: attributes,
      prd_variants: variants
        ? variants.map((variant) => ({
            var_name: variant.name,
            var_images: variant.images,
            var_options: variant.options,
          }))
        : [],
    });

    if (!newProduct) throw new BadRequestError('Failed to create product');

    await this.variantService.createVariants({
      product: newProduct,
      variants,
      skuList,
    });

    return omitFields({
      fields: ['rating', 'views', 'uniqueViews', 'createdAt', 'updatedAt'],
      object: newProduct,
    });
  }

  async updateProduct({
    productId,
    name,
    mainImage,
    subImages,
    price,
    originalPrice,
    quantity,
    description,
    category,
    attributes,
    variants,
    skuList,
    status,
  }) {
    const foundProduct = await this.productRepository.getById(productId);
    if (!foundProduct) {
      throw new BadRequestError('Product not found');
    }

    // Validate and fetch category if provided
    let updatedCategories = category || foundProduct.category;
    if (category) {
      await Promise.all(
        category.map(async ({ id }) => {
          const categoryData = await this.categoryRepository.getById(id);
          if (!categoryData) {
            throw new BadRequestError(`Category with ID ${id} not found`);
          }
        })
      );
    }

    let updatedVariants = foundProduct.variants;
    if (variants) {
      updatedVariants = variants.map((variant, idx) => {
        const existingVariant = foundProduct.variants[idx] || {};
        return {
          name: variant.name || existingVariant.var_name,
          images: variant.images || existingVariant.var_images,
          options: variant.options || existingVariant.var_options,
        };
      });
    }

    if (skuList) {
      await this.variantService.updateVariants({
        foundProduct,
        variants: updatedVariants,
        skuList,
      });
    }

    // Calculate total quantity
    const totalQuantity = skuList
      ? skuList.reduce((total, sku) => total + (sku.quantity || 0), 0)
      : quantity || foundProduct.quantity;

    // Update subImages with unique entries
    const variantImages = updatedVariants.flatMap(({ images }) => images || []);
    const updatedSubImages = Array.from(
      new Set([...(subImages || foundProduct.subImages), ...variantImages])
    );

    const updateData = removeUndefinedObject({
      prd_name: name,
      prd_main_image: mainImage,
      prd_sub_images: updatedSubImages,
      prd_price: price,
      prd_original_price: originalPrice,
      prd_quantity: totalQuantity,
      prd_description: description,
      prd_category: updatedCategories,
      prd_attributes: attributes,
      prd_variants: variants
        ? updatedVariants.map((variant) => ({
            var_name: variant.name,
            var_images: variant.images,
            var_options: variant.options,
          }))
        : null,
      prd_status: status,
    });

    const parsedUpdateData = updateNestedObjectParser(updateData);

    // Update product
    const updatedProduct = await this.productRepository.updateById(
      productId,
      parsedUpdateData
    );

    return {
      product: omitFields({
        fields: ['createdAt', 'updatedAt'],
        object: updatedProduct,
      }),
    };
  }

  async getProductDetailsPublic({ productId }) {
    const foundProduct = await this.productRepository.getById(productId);

    if (!foundProduct) {
      throw new BadRequestError('Product not found');
    }

    const skuList = await this.variantService.getPublicVariantByProductId(
      productId
    );

    return {
      product: omitFields({
        fields: [
          'subImages',
          'quantity',
          'category',
          'attributes',
          'views',
          'uniqueViews',
          'createdAt',
          'updatedAt',
          'sold',
          'status',
        ],
        object: foundProduct,
      }),
      skuList: skuList.map((sku) =>
        omitFields({
          fields: [
            'createdAt',
            'updatedAt',
            'status',
            'sold',
            'name',
            'productId',
          ],
          object: sku,
        })
      ),
    };
  }

  async getProductDetails({ productId }) {
    const foundProduct = await this.productRepository.getById(productId);

    if (!foundProduct) {
      throw new BadRequestError('Product not found');
    }

    const skuList = await this.variantService.getVariantByProductId(productId);

    return {
      product: omitFields({
        fields: ['createdAt', 'updatedAt'],
        object: foundProduct,
      }),
      skuList: skuList.map((sku) =>
        omitFields({
          fields: ['createdAt', 'updatedAt', 'name', 'productId'],
          object: sku,
        })
      ),
    };
  }

  async getAllProductsPublic({
    search,
    category,
    minPrice,
    maxPrice,
    sort,
    page,
    size,
    attributes,
  }) {
    const filter = { prd_status: ProductStatus.ACTIVE };

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
      filter['category.id'] = category;
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
          SortField[sort.replace('-', '')] || 'prd_rating'
        }`
      : '-prd_rating';

    const query = {
      sort: mappedSort,
      page: parseInt(page),
      size: parseInt(size),
    };

    const products = await this.productRepository.getAll({
      filter: filter,
      queryOptions: query,
    });

    return products.map((product) =>
      omitFields({
        fields: [
          'subImages',
          'quantity',
          'category',
          'attributes',
          'views',
          'uniqueViews',
          'createdAt',
          'updatedAt',
          'sold',
          'status',
        ],
        object: product,
      })
    );
  }

  async getAllProducts({
    search,
    category,
    minPrice,
    maxPrice,
    sort,
    page,
    size,
    attributes,
  }) {
    const filter = {};

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
      filter['category.id'] = category;
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
          SortField[sort.replace('-', '')] || 'prd_rating'
        }`
      : '-prd_rating';

    const query = {
      sort: mappedSort,
      page: parseInt(page),
      size: parseInt(size),
    };

    const products = await this.productRepository.getAll({
      filter: filter,
      queryOptions: query,
    });

    return products.map((product) =>
      omitFields({
        fields: [
          'createdAt',
          'updatedAt',
          'subImages',
          'description',
          'category',
          'attributes',
        ],
        object: product,
      })
    );
  }
}

module.exports = ProductService;
