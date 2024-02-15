// Get page and size, which used for pagination
const getPagination = (page, size) => {
  const limit = size ? +size : 4;
  const offset = page ? page * limit : 0;

  return { limit, offset };
};

/**
 * sortBy default to be 'popularity'
 * sortOrder accept 1 or -1, default to -1
 */
const getSortOption = (query) => {
  const sortField = query.sortBy ? query.sortBy : 'popularity';
  const sortOrder = query.sortOrder ? parseInt(query.sortOrder) : -1;

  // _id here is to keep consistency sort
  return { [sortField]: sortOrder, _id: -1 };
};

module.exports = { getPagination, getSortOption };
