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
      message: 'Tạo danh mục thành công',
      metadata: await this.categoryService.createCategory(req.body),
    }).send(res);
  };

  getCategoriesByParentId = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy danh sách danh mục theo danh mục cha thành công',
      metadata: await this.categoryService.getCategoriesByParentId(req.query),
    }).send(res);
  };

  getAllCategories = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy tất cả danh mục thành công',
      metadata: await this.categoryService.getAllCategories(req.query),
    }).send(res);
  };

  deleteCategory = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Xóa danh mục thành công',
      metadata: await this.categoryService.deleteCategory(req.query),
    }).send(res);
  };

  updateCategory = async (req, res, next) => {
    new ActionSuccess({
      message: 'Cập nhật danh mục thành công',
      metadata: await this.categoryService.updateCategory(req.body),
    }).send(res);
  };
}

module.exports = new CategoryController();
