// src/controllers/blog.controller.js
'use strict';

const BlogService = require('../services/blog.service');
const {
  CreateSuccess,
  SuccessResponse,
  NoContentSuccess,
} = require('../utils/successResponse');

class BlogController {
  create = async (req, res, next) => {
    const blog = await BlogService.createBlog(req.body);
    new CreateSuccess({
      message: 'Blog created successfully',
      metadata: blog,
    }).send(res);
  };

  findAll = async (req, res, next) => {
    const blogs = await BlogService.getAllBlogs(req.query);
    new SuccessResponse({
      message: 'Blogs retrieved successfully',
      metadata: blogs,
    }).send(res);
  };

  findOne = async (req, res, next) => {
    const blog = await BlogService.getBlogById(req.params.blogId);
    new SuccessResponse({
      message: 'Blog fetched successfully',
      metadata: blog,
    }).send(res);
  };

  update = async (req, res, next) => {
    const updated = await BlogService.updateBlog(req.params.blogId, req.body);
    new SuccessResponse({
      message: 'Blog updated successfully',
      metadata: updated,
    }).send(res);
  };

  delete = async (req, res, next) => {
    await BlogService.deleteBlog(req.params.blogId);
    new NoContentSuccess().send(res);
  };

  findAllByType = async (req, res, next) => {
    const blogs = await BlogService.getRelatedBlogsType(req.query.type);
    new SuccessResponse({
      message: 'Blogs retrieved successfully',
      metadata: blogs,
    }).send(res);
  };

  findAllByTypeExUser = async (req, res, next) => {
    const blogs = await BlogService.getRelatedBlogs(req.query.type, req.query.idUser);
    new SuccessResponse({
      message: 'Blogs retrieved successfully',
      metadata: blogs,
    }).send(res);
  };
}

module.exports = new BlogController();
