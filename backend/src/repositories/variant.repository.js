const BaseRepository = require('./base.repository');
const variantModels = require('../models/variant.model');

class VariantRepository extends BaseRepository {
  constructor() {
    super(variantModels);
    this.model = variantModels;
  }

  async getVariantByFilter(filter) {
    const variants = await this.model.find(filter).lean();
    return variants.map(this.formatDocument.bind(this));
  }

  async deleteByProductId(productId) {
    return await this.model.deleteMany({ prd_id: productId });
  }

  async updateMany(filter, data) {
    const variants = await this.model.updateMany(filter, data);

    return variants;
  }

  async findBySlug(productId, slug) {
    const variant = await this.model
      .findOne({ prd_id: productId, var_slug: slug })
      .lean();

    return this.formatDocument(variant);
  }

  async updateSku(sku) {
    const updateData = {
      var_price: sku.price,
      var_quantity: sku.quantity,
      var_status: sku.status,
      updatedBy: sku.updatedBy,
      updatedAt: new Date(),
    };

    return await this.model.updateOne(
      { prd_id: sku.productId, var_slug: sku.slug },
      { $set: updateData }
    );
  }

  async getByQuery({ filter = {}, fields = '', options = {} }) {
    let documentQuery = this.model.findOne(filter, fields, options);
    documentQuery = documentQuery.populate([
      { path: 'prd_id', select: 'prd_name prd_code prd_slug' },
      { path: 'createdBy', select: 'usr_name usr_email' },
      { path: 'updatedBy', select: 'usr_name usr_email' },
    ]);
    const document = await documentQuery.lean();

    return this.formatDocument(document);
  }

  async getVariantsByProductId(productId, status) {
    const filter = { prd_id: productId };
    if (status) {
      filter.var_status = status;
    }
    return await this.model
      .find(filter)
      .populate([
        { path: 'createdBy', select: 'usr_name usr_email' },
        { path: 'updatedBy', select: 'usr_name usr_email' },
      ])
      .lean()
      .then((docs) => docs.map(this.formatDocument.bind(this)));
  }

  formatDocument(variant) {
    if (!variant) return null;

    return {
      id: variant._id,
      productId: variant.prd_id?._id || variant.prd_id,
      product: variant.prd_id
        ? {
            name: variant.prd_id.prd_name,
            code: variant.prd_id.prd_code,
            slug: variant.prd_id.prd_slug,
          }
        : null,
      name: variant.prd_name,
      slug: variant.var_slug,
      tierIndex: variant.var_tier_idx,
      isDefault: variant.var_default,
      price: variant.var_price,
      quantity: variant.var_quantity,
      sold: variant.var_sold,
      returned: variant.var_returned,
      status: variant.var_status,
      createdBy: variant.createdBy,
      createdDetail: variant.createdBy
        ? {
            id: variant.createdBy._id,
            name: variant.createdBy.usr_name,
            email: variant.createdBy.usr_email,
          }
        : null,
      updatedBy: variant.updatedBy,
      updatedDetail: variant.updatedBy
        ? {
            id: variant.updatedBy._id,
            name: variant.updatedBy.usr_name,
            email: variant.updatedBy.usr_email,
          }
        : null,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    };
  }
}

module.exports = VariantRepository;
