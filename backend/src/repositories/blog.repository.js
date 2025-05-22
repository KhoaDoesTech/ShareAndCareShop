// src/repositories/blog.repository.js
'use strict';

const blogModel = require('../models/blog.model');
const BaseRepository = require('./base.repository');

class BlogRepository extends BaseRepository {
  constructor() {
    super(blogModel);
    this.model = blogModel;
  }
}

module.exports = new BlogRepository();
