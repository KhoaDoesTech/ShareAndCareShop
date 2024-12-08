'use strict';

const RoleService = require('../services/role.service');
const {
  CreateSuccess,
  NoContentSuccess,
  ActionSuccess,
} = require('../utils/successResponse');

class RoleController {
  constructor() {
    this.roleService = new RoleService();
  }

  createRole = async (req, res, next) => {
    new CreateSuccess({
      message: 'Coupon created successfully',
      metadata: await this.roleService.createRole(req.body),
    }).send(res);
  };

  getRoles = async (req, res, next) => {
    new ActionSuccess({
      message: 'Roles fetched successfully',
      metadata: await this.roleService.getAllRoles(req.query),
    }).send(res);
  };

  getRoleById = async (req, res, next) => {
    new ActionSuccess({
      message: 'Role fetched successfully',
      metadata: await this.roleService.getRoleById(req.params.roleId),
    }).send(res);
  };

  updateRole = async (req, res, next) => {
    new ActionSuccess({
      message: 'Role updated successfully',
      metadata: await this.roleService.updateRole({
        roleId: req.params.roleId,
        ...req.body,
      }),
    }).send(res);
  };

  deleteRole = async (req, res, next) => {
    await this.roleService.deleteRole(req.params.roleId);
    new NoContentSuccess({
      message: 'Role deleted successfully',
    }).send(res);
  };
}

module.exports = new RoleController();
