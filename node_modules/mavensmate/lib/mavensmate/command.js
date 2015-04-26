'use strict';

var _               = require('lodash');
var logger          = require('winston');
var MetadataHelper  = require('./metadata').MetadataHelper;

/**
 * Base command class
 * @param {Array} args
 * @param {Array[0]} - client instance (object)
 * @param {Array[1]} - payload for the command (object)
 * @param {Array[2]} - callback for the command, will be executed in this.respond for non-command line clients (function)
 */
var BaseCommand = function(args) {
  this.client = args[0];
  this.payload = args[1];
  this._callback = args[2];
  this.metadataHelper = new MetadataHelper();
};

/**
 * Sets unique identifier for the command for tracking purposes
 * @param {String} id - unique id (via uuid)
 */
BaseCommand.prototype.setId = function(id) {
  this._id = id;
};

/**
 * Returns the command id
 * @return {String} - unique id of the command
 */
BaseCommand.prototype.getId = function() {
  return this._id;
};

/**
 * Sets the project running this command (optional)
 * @param {Object} project - project instance
 */
BaseCommand.prototype.setProject = function(project) {
  this._project = project;
};

/**
 * Returns the project running this command (optional)
 * @return {Object} - project instance
 */
BaseCommand.prototype.getProject = function() {
  return this._project;
};

BaseCommand.prototype.respondRaw = function(res) {
  if (!this.client.isCommandLine()) {
    return res;
  } else {
    console.log(res);
  }
};

/**
 * Responses to the client that executed the command
 * @param  {Object|String} res   - response from the command
 * @param  {Boolean} success - whether the command was successfull (TODO: do we need this?)
 * @param  {Error} error   - error instance (for failed commands)
 * @return {String|Object|STDOUT}         - depends on the configuration of the client (more documentation needed here)
 */
BaseCommand.prototype.respond = function(res, success, error) {
  // if we're headless, we need to properly format the response with JSON
  // otherwise we can just log the result
  var self = this;
  var response;
  if (!self.client.isCommandLine() || self.client.serverPort) {
    // client is likely a node client (like atom), so return a JavaScript object
    response = {};
    success = success === undefined ? true : success;
    response.result = res;
    if (!success && error) {
      response.error = error.message;
      response.stack = error.stack;
    }
    logger.debug('response: ');
    logger.debug(response);
    if (_.isFunction(self._callback)) {
      if (success) {
        self._callback(null, response);
      } else {
        self._callback(response);
      }
    } else {
      return response;
    }
  } else if (self.client.isHeadless() && !self.client.verbose) {
    // this is a standard response to a consuming terminal client (sublime)
    // response should be deserialized into a valid JSON string
    response = {};
    if (success === undefined) {
      success = true;
    }
    if (_.isArray(res)) {
      response.result = res;
      response.success = success;
    } else if (typeof res === 'object') {
      response.result = res;
      if (!_.has(res, 'success')) {
        response.success = success;
      }
    } else if (_.isString(res)) {
      response.result = res;
      response.success = success;
    }
    if (!success && error) {
      response.success = false;
      response.result = error.message;
      response.stack = error.stack;
      console.error(JSON.stringify(response));
      process.exit(1);
    } else {
      console.log(JSON.stringify(response));
      process.exit(0);
    }
  } else {
    logger.debug(res);
    if (!success && error !== undefined && error.stack !== undefined) {
      var endOfLine = require('os').EOL;
      var stackLines = error.stack.split(endOfLine);
      var errors = stackLines[0];
      _.each(errors.split('Error: '), function(e) {
        if (e.length > 0) {
          console.error(e);
        }        
      });
      if (self.client.verbose) {
        stackLines.shift();
        console.error(stackLines.join(endOfLine));
      }
      process.exit(1);
    } else {
      console.log(res);
      process.exit(0);
    }
  }
};

/**
 * Whether the command is requesting a UI
 * @return {Boolean}
 */
BaseCommand.prototype.isUICommand = function() {
  return (this.payload && this.payload.args) ? this.payload.args.ui : false;
};

module.exports = BaseCommand;
