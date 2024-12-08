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
      message: 'Users retrieved successfully',
      metadata: await this.userService.getAllUsers(req.query),
    }).send(res);
  };

  changePassword = async (req, res, next) => {
    await this.userService.changePassword({
      userId: req.user.id,
      ...req.body,
    });
    new ActionSuccess({
      message: 'Password changed successfully',
    }).send(res);
  };

  changeRole = async (req, res, next) => {
    new ActionSuccess({
      message: 'Role changed successfully',
      metadata: await this.userService.assignRoleToUser({
        userId: req.params.userId,
        ...req.body,
      }),
    }).send(res);
  };

  blockUser = async (req, res, next) => {
    new ActionSuccess({
      message: 'User blocked successfully',
      metadata: await this.userService.blockUser(req.params.userId),
    }).send(res);
  };

  unBlockUser = async (req, res, next) => {
    new ActionSuccess({
      message: 'User unblocked successfully',
      metadata: await this.userService.unblockUser(req.params.userId),
    }).send(res);
  };
}

module.exports = new UserController();
