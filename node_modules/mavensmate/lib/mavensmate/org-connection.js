'use strict';
var Promise                 = require('bluebird');
var _                 = require('lodash');
var fs                = require('fs-extra');
var path              = require('path');
var uuid              = require('node-uuid');
var SalesforceClient  = require('./sfdc-client');
var KeychainService   = require('./keychain');

// Q.longStackSupport = true;

/**
 * Service to get, add, update, remove org connections for a given project
 * @param {Object} project - project instance
 */
function OrgConnectionService(project) {
  this.project = project;
  this.keychainService = new KeychainService();
}

/**
 * Lists all org connections for this project
 * @return {Array} - list of connections
 */
OrgConnectionService.prototype.listAll = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    fs.readJson(path.join(self.project.path, 'config', '.org_connections'), function(err, connections) {
      if (err) {
        if (err.message.indexOf('ENOENT') >= 0) {
          resolve([]);
        } else {
          reject(new Error('Could not load org connections: '+err.message));
        }
      } else {
        resolve(connections);
      }
    });
  });
};

/**
 * Adds an org connection
 * @param {String} username
 * @param {String} password
 * @param {String} orgType - production, sandbox, developer
 */
OrgConnectionService.prototype.add = function(username, password, orgType) {
  var self = this;
  return new Promise(function(resolve, reject) {
    var newConnectionId = uuid.v1();
    orgType = orgType || 'developer';
    var newConnection = {
      username : username,
      environment: orgType.toLowerCase(),
      id: newConnectionId
    };
    if (self.keychainService.useSystemKeychain()) {
      self.keychainService.storePassword(newConnectionId, password);
    } else {
      newConnection.password = password;
    }
    
    var orgConnectionClient = new SalesforceClient({ username: username, password: password });
    orgConnectionClient.initialize()
      .then(function() {
        if (!fs.existsSync(path.join(self.project.path, 'config', '.org_connections'))) {
          fs.outputFile(path.join(self.project.path, 'config', '.org_connections'), JSON.stringify([newConnection], null, 4), function(err) {
            if (err) {
              reject(new Error('Could not add org connection: '+err.message));
            } else {
              resolve();
            }
          });
        } else {
          fs.readJson(path.join(self.project.path, 'config', '.org_connections'), function(err, connections) {
            if (err) {
              reject(new Error('Could not load org connections: '+err.message));
            } else {
              connections.push(newConnection);
              fs.outputFile(path.join(self.project.path, 'config', '.org_connections'), JSON.stringify(connections, null, 4), function(err) {
                if (err) {
                  reject(new Error('Could not add org connection: '+err.message));
                } else {
                  resolve();
                }
              });
            }
          });
        }
      })
      .catch(function(err) {
        reject(new Error('Could not add org connection: '+err.message));
      })
      .done();
  });
};

/** 
 * Updates an org connection by id
 * @param  {String} id
 * @param  {String} username
 * @param  {String} password
 * @param  {String} orgType
 * @return {Promise}
 */
OrgConnectionService.prototype.update = function(id, username, password, orgType) {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (!fs.existsSync(path.join(self.project.path, 'config', '.org_connections'))) {
      fs.writeSync(path.join(self.project.path, 'config', '.org_connections'), []);
    }
    fs.readJson(path.join(self.project.path, 'config', '.org_connections'), function(err, connections) {
      if (err) {
        reject(new Error('Could not load org connections: '+err.message));
      } else {
        _.each(connections, function(c) {
          if (c.id === id) {
            c.username = username;
            c.orgType = orgType.toLowerCase();
            if (self.keychainService.useSystemKeychain()) {
              self.keychainService.replacePassword(c.id, password);
            } else {
              c.password = password;
            }
            return false;
          }
        });
        fs.outputFile(path.join(self.project.path, 'config', '.org_connections'), JSON.stringify(connections, null, 4), function(err) {
          if (err) {
            reject(new Error('Could not update org connections: '+err.message));
          } else {
            resolve();
          }
        });
      }
    });
  });
};

/**
 * Removes an org connection
 * @param  {String} id
 * @return {Promise}
 */
OrgConnectionService.prototype.remove = function(id) {
  var self = this;
  return new Promise(function(resolve, reject) {
    fs.readJson(path.join(self.project.path, 'config', '.org_connections'), function(err, connections) {
      if (err) {
        reject(new Error('Could not load org connections: '+err.message));
      } else {
        var newConnections = [];
        _.each(connections, function(c) {
          if (c.id !== id) {
            newConnections.push(c);
          }
        });
        fs.outputFile(path.join(self.project.path, 'config', '.org_connections'), JSON.stringify(newConnections, null, 4), function(err) {
          if (err) {
            reject(new Error('Could not write org connections: '+err.message));
          } else {
            resolve();
          }
        });
      }
    });
  });
};

module.exports = OrgConnectionService;