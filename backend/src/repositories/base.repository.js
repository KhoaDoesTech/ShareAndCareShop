const { NotFoundError } = require('../utils/errorResponse');
const APIFeatures = require('../utils/apiFeatures');

class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async create(data) {
    const document = await this.model.create(data);
    return this.formatDocument(document);
  }

  async getByQuery(query, populateOptions = null) {
    let documentQuery = this.model.findOne(query);
    if (populateOptions) {
      documentQuery = documentQuery.populate(populateOptions);
    }
    const document = await documentQuery.lean();

    console.log(document);

    return this.formatDocument(document);
  }

  async getById(id, populateOptions = null) {
    let documentQuery = this.model.findById(id);
    if (populateOptions) {
      documentQuery = documentQuery.populate(populateOptions);
    }
    const document = await documentQuery.lean();

    return this.formatDocument(document);
  }

  async updateById(id, data) {
    const document = await this.model
      .findByIdAndUpdate(id, data, {
        new: true,
        runValidators: true,
      })
      .lean();
    if (!document) {
      throw new NotFoundError('No document found with that ID');
    }
    return this.formatDocument(document);
  }

  async deleteById(id) {
    const document = await this.model.findByIdAndDelete(id);
    if (!document) {
      throw new NotFoundError('No document found with that ID');
    }
    return this.formatDocument(document);
  }

  async getAll({ filter = {}, queryOptions = {}, populateOptions = null }) {
    const features = new APIFeatures(
      this.model.find(filter).populate(populateOptions),
      queryOptions
    )
      .filter()
      .limitFields()
      .sort()
      .paginate();

    const documents = await features.query;
    return documents.map(this.formatDocument.bind(this));
  }

  async countDocuments(filter) {
    return await this.model.countDocuments(filter);
  }

  formatDocument(document) {
    return document;
  }
}

module.exports = BaseRepository;
