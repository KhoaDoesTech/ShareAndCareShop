const CategoryRepository = require('../repositories/category.repository');
const { BadRequestError } = require('../utils/errorResponse');
const { pickFields } = require('../utils/helpers');

class CategoryService {
  constructor() {
    this.categoryRepository = new CategoryRepository();
  }

  async createCategory({ name, parentId }) {
    let rightValue = 0;

    if (parentId) {
      const parentCategory = await this.categoryRepository.getById(parentId);
      if (!parentCategory) {
        throw new BadRequestError('Không tìm thấy danh mục cha');
      }
      rightValue = parentCategory.right;
      await this.categoryRepository.updateManyCategories(rightValue, 2);
    } else {
      const maxRightValue = await this.categoryRepository.getByQuery({
        fields: 'cat_right',
        options: { sort: { cat_right: -1 } },
      });
      rightValue = maxRightValue ? maxRightValue.cat_right + 1 : 1;
    }

    const newCategory = await this.categoryRepository.create({
      cat_name: name,
      cat_left: rightValue,
      cat_right: rightValue + 1,
      cat_parent_id: parentId || null,
    });

    if (!newCategory) throw new BadRequestError('Tạo danh mục thất bại');

    return pickFields({
      fields: ['name', 'parentId', 'id'],
      object: newCategory,
    });
  }

  async deleteCategory({ categoryId }) {
    try {
      return this.categoryRepository.deleteCategoryById(categoryId);
    } catch (error) {
      throw new BadRequestError('Xóa danh mục thất bại');
    }
  }

  async updateCategory({ categoryId, name }) {
    try {
      const updatedCategory = await this.categoryRepository.updateById(
        categoryId,
        {
          cat_name: name,
        }
      );

      return pickFields({
        fields: ['name', 'parentId', 'id'],
        object: updatedCategory,
      });
    } catch (error) {
      throw new BadRequestError('Cập nhật danh mục thất bại');
    }
  }

  async getCategoriesByParentId({ parentId }) {
    if (parentId) {
      const parentCategory = await this.categoryRepository.getById(parentId);
      if (!parentCategory) {
        throw new BadRequestError('Không tìm thấy danh mục cha');
      }
    }

    const queryOptions = {
      sort: 'cat_left',
      fields: 'cat_name cat_left cat_right cat_parent_id',
    };

    const categories = await this.categoryRepository.getAll({
      filter: {
        cat_parent_id: parentId || null,
      },
      queryOptions,
    });

    return categories.map((category) =>
      pickFields({
        fields: ['name', 'parentId', 'id'],
        object: category,
      })
    );
  }

  async getAllCategories({ parentId = null, size = 1 }) {
    const condition = await this._buildCondition(parentId);

    const queryOptions = {
      sort: 'cat_left',
      fields: 'cat_name cat_left cat_right cat_parent_id',
    };

    const categories = await this.categoryRepository.getAll({
      filter: condition,
      queryOptions,
    });

    const rootCategory = parentId
      ? categories.find((cat) => cat.id.toString() === parentId.toString())
      : null;

    return this._buildCategoryTree(categories, size, rootCategory);
  }

  async _buildCondition(parentId) {
    if (!parentId) return {};
    try {
      const parentCategory = await this.categoryRepository.getById(parentId);
      return {
        cat_left: { $gt: parentCategory.left },
        cat_right: { $lte: parentCategory.right },
      };
    } catch (error) {
      throw new BadRequestError('Không tìm thấy danh mục cha');
    }
  }

  _buildCategoryTree(categories, maxDepth, rootCategory = null) {
    const stack = [];
    const tree = [];
    let currentDepth = 0;

    const isWithinRootBounds = (category) =>
      !rootCategory ||
      (category.left > rootCategory.left &&
        category.right < rootCategory.right);

    for (const category of categories) {
      if (!isWithinRootBounds(category)) continue;

      while (stack.length && stack[stack.length - 1].right < category.left) {
        stack.pop();
        currentDepth--;
      }

      if (currentDepth >= maxDepth) continue;

      const newNode = this._createCategoryNode(category);

      if (stack.length > 0) {
        stack[stack.length - 1].children.push(newNode);
      } else {
        tree.push(newNode);
      }

      stack.push({ ...category, ...newNode });
      currentDepth++;
    }

    return tree;
  }

  _createCategoryNode(category) {
    return {
      id: category.id,
      name: category.name,
      parentId: category.parentId,
      children: [],
    };
  }
}

module.exports = CategoryService;
