'use strict';

/**
 * nconf is used globally for config, client instantiates the necessary config files
 * import config throughout the application to share the global nconf
 */

var nconf = require('nconf');
module.exports = nconf;