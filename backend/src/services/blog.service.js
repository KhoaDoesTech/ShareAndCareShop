'use strict';

const BlogRepository = require('../repositories/blog.repository');

class BlogService {
  createBlog(data) {
    return BlogRepository.create(data);
  }

  getAllBlogs(filter) {
    return BlogRepository.find(filter);
  }

  getBlogById(blogId) {
    return BlogRepository.findById(blogId);
  }

  updateBlog(blogId, data) {
    return BlogRepository.findByIdAndUpdate(blogId, data, { new: true });
  }

  deleteBlog(blogId) {
    return BlogRepository.delete(blogId);
  }

  getRelatedBlogs(type, excludeId) {
    return BlogRepository.find({
      type,
      _id: { $ne: excludeId }
    });
  }

  getRelatedBlogsType(type) {
    return BlogRepository.find({
      type
    });
  }

  
}

module.exports = new BlogService();
