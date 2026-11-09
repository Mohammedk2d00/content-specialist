// Runs every draft check in a fixed order. Shared by build.js (command line) and the browser extension,
// so both judge a draft the same way. The order is the order of the printed warnings.
const checkSchema = require('./schema.js');
const CONTENT_CHECKS = [require('./posts.js'), require('./style.js'), require('./register.js'), require('./facts.js'), require('./names.js'), require('./review.js')];

module.exports = function runChecks(data) {
  const errors = [], warnings = [], notes = [];
  const posts = data && Array.isArray(data.posts) ? data.posts : [];
  const ctx = { data: data, posts: posts, errors: errors, warnings: warnings, notes: notes };
  checkSchema(ctx);
  // the content checks assume a valid structure
  if (!errors.length) CONTENT_CHECKS.forEach(function (check) { check(ctx); });
  return { errors: errors, warnings: warnings, notes: notes };
};
