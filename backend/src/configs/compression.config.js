// Compression options configuration
const compressionOptions = {
  level: 6, // Compression level (0-9)
  threshold: 16 * 1024, // Minimum size in bytes to compress
  filter: (req, res) => {
    // Do not compress responses with 'x-no-compress' header
    if (req.headers['x-no-compress']) {
      return false;
    }
    return true;
  },
};

module.exports = compressionOptions;
