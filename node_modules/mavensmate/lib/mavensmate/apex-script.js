'use strict';

var Promise   = require('bluebird');
var fs        = require('fs-extra');
var path      = require('path');
var util      = require('./util').instance;
var _         = require('lodash');

/**
 * Service to handle interaction with the client's editor (sublime, atom, etc.)
 * @param {Client} client
 */
var ApexScriptService = function(project) {
  if (!project) {
    throw new Error('ApexScriptService requires a valid project instance');
  }
  this.project = project;
};

/**
 * Creates new apex script
 * @param  {String} scriptPath
 * @return {Promise}
 */
ApexScriptService.prototype.create = function(name) {
  var self = this;
  return new Promise(function(resolve, reject) {
    try {
      var dir = path.join(self.project.path, 'apex-scripts');
      fs.ensureDirSync(dir);
      fs.outputFileSync( path.join( dir, [name, 'cls'].join('.') ), '');
      resolve('Apex script created successfully');
    } catch(e) {
      reject(e);
    }
  });
};

/**
 * Executes apex script
 * @param  {String} scriptPath
 * @return {Promise}
 */
ApexScriptService.prototype.execute = function(scriptPaths) {
  var self = this;
  if (!_.isArray(scriptPaths)) {
    scriptPaths = [scriptPaths];
  }
  return new Promise(function(resolve, reject) {
    var scriptPromises = [];
    _.each(scriptPaths, function(sp) {
      var scriptBody = util.getFileBody(sp);
      var payload = {
        body: scriptBody
      };
      scriptPromises.push ( self.project.sfdcClient.executeApex(payload) );
    });

    Promise.all(scriptPromises)
      .then(function(results) {
        var result = {};
        _.each(scriptPaths, function(sp, i) {
          result[sp] = results[i];
        });
        resolve(result);
      })
      .catch(function(error) {
        reject(error);
      })
      .done();
  });
};


module.exports = ApexScriptService;