const CategoryService = require('../services/category.service');
const {
  ActionSuccess,
  CreateSuccess,
  NoContentSuccess,
} = require('../utils/successResponse');

class CategoryController {
  constructor() {
    this.categoryService = new CategoryService();
  }

  createCategory = async (req, res, next) => {
    new CreateSuccess({
      message: 'Category created successfully',
      metadata: await this.categoryService.createCategory(req.body),
    }).send(res);
  };

  getCategoriesByParentId = async (req, res, next) => {
    new ActionSuccess({
      message: 'Categories retrieved successfully',
      metadata: await this.categoryService.getCategoriesByParentId(req.query),
    }).send(res);
  };

  getAllCategories = async (req, res, next) => {
    new ActionSuccess({
      message: 'Categories retrieved successfully',
      metadata: await this.categoryService.getAllCategories(req.query),
    }).send(res);
  };

  deleteCategory = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Category deleted successfully',
      metadata: await this.categoryService.deleteCategory(req.query),
    }).send(res);
  };

  updateCategory = async (req, res, next) => {
    new ActionSuccess({
      message: 'Category updated successfully',
      metadata: await this.categoryService.updateCategory(req.body),
    }).send(res);
  };
}

module.exports = new CategoryController();
