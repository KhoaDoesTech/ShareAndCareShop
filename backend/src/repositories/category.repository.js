const BaseRepository = require('./base.repository');
const categoryModels = require('../models/category.model');

class CategoryRepository extends BaseRepository {
  constructor() {
    super(categoryModels);
    this.model = categoryModels;
  }

  async deleteCategoryById(categoryId) {
    const category = await this.model.findById(categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    const leftValue = category.cat_left;
    const rightValue = category.cat_right;
    const width = rightValue - leftValue + 1;

    const deleteResult = await this.model.deleteMany({
      cat_left: { $gte: leftValue, $lte: rightValue },
    });

    await this.model.updateMany(
      { cat_right: { $gt: rightValue } },
      { $inc: { cat_right: -width } }
    );

    await this.model.updateMany(
      { cat_left: { $gt: rightValue } },
      { $inc: { cat_left: -width } }
    );

    return { deletedCount: deleteResult.deletedCount };
  }

  async updateManyCategories(rightValue, width) {
    await this.model.updateMany(
      { cat_right: { $gte: rightValue } },
      { $inc: { cat_right: width } }
    );

    await this.model.updateMany(
      { cat_left: { $gt: rightValue } },
      { $inc: { cat_left: width } }
    );
  }

  async getByQuery({ filter = {}, fields = '', options = {} }) {
    let documentQuery = this.model.findOne(filter, fields, options);

    return await documentQuery.lean();
  }

  formatDocument(category) {
    if (!category) return null;

    const formattedCategory = {
      id: category._id,
      name: category.cat_name,
      left: category.cat_left,
      right: category.cat_right,
      parentId: category.cat_parent_id,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };

    return formattedCategory;
  }
}

module.exports = CategoryRepository;
