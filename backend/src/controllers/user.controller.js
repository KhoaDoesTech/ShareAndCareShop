const UserService = require('../services/user.service');
const {
  CreateSuccess,
  NoContentSuccess,
  ActionSuccess,
} = require('../utils/successResponse');

class UserController {
  constructor() {
    this.userService = new UserService();
  }

  getAllUsers = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy danh sách người dùng thành công',
      metadata: await this.userService.getAllUsers(req.query),
    }).send(res);
  };

  changePassword = async (req, res, next) => {
    await this.userService.changePassword({
      userId: req.user.id,
      ...req.body,
    });
    new ActionSuccess({
      message: 'Đổi mật khẩu thành công',
    }).send(res);
  };

  changeRole = async (req, res, next) => {
    new ActionSuccess({
      message: 'Thay đổi vai trò thành công',
      metadata: await this.userService.assignRoleToUser({
        userId: req.params.userId,
        ...req.body,
      }),
    }).send(res);
  };

  blockUser = async (req, res, next) => {
    new ActionSuccess({
      message: 'Khóa người dùng thành công',
      metadata: await this.userService.blockUser(req.params.userId),
    }).send(res);
  };

  unBlockUser = async (req, res, next) => {
    new ActionSuccess({
      message: 'Mở khóa người dùng thành công',
      metadata: await this.userService.unblockUser(req.params.userId),
    }).send(res);
  };
}

module.exports = new UserController();
