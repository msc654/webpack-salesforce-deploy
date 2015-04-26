/**
 * Configures global winston logger instance
 * Client requires and configures, other modules require('winston') to share global winston object
 */

module.exports = function (client) {
  'use strict';

  var fs = require('fs');
  var path = require('path');
  var winston = require('winston');
  var config = require('./config');

  try {
    winston.remove(winston.transports.Console);
  } catch(e) { }
  
  var hasDebuggingOption;
  if (client.isCommandLine()) {
    // check if global --log is on
    var argv = client.program.normalize(process.argv);
    hasDebuggingOption = argv.indexOf('-d') > -1 || argv.indexOf('--verbose') > -1; // Need this early
  }

  // var logger = new (winston.Logger)({
  //   exitOnError: false
  // });
  // 
  // file-based logging, set up in client
  var logFileLevel;
  if (config.get('mm_log_level')) {
    logFileLevel = config.get('mm_log_level').toLowerCase();
  } else {
    logFileLevel = 'info'; 
  }

  // if --verbose flag, add console logging
  if (hasDebuggingOption || client.verbose) {
    winston.cli();
    winston.add(winston.transports.Console, {
      level: logFileLevel,
      exitOnError: false,
      prettyPrint: true,
      colorize: true
    });
  }

  // place logs in mm_log_location if it exists
  if (fs.existsSync(config.get('mm_log_location'))) {
    try {
      winston.add(winston.transports.File, { 
        filename: path.join(config.get('mm_log_location'), 'mavensmate.log'),
        level: logFileLevel,
        json: false
      });
    } catch(e) {
      if (e.message.indexOf('Transport already attached') === -1) {
        throw e;
      }
    }
  }

  if (hasDebuggingOption) {
    winston.debug('Debug logging is on');
  }

  return winston;
};