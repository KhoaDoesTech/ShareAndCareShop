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
}

module.exports = new UserController();
