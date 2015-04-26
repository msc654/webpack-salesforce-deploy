'use strict';

var Promise         = require('bluebird');
var mavensMateFile  = require('./file');
var logger          = require('winston');
var _               = require('lodash');

var CheckpointService = function(project) {
  this.project = project;
};

/**
 * Create checkpoint at the provided line for the provided file path
 * @param {String} filePath
 * @param {Integer} lineNumber
 * @return {Promise}       
 */
CheckpointService.prototype.createCheckpoint = function(filePath, lineNumber) {
  var self = this;
  return new Promise(function(resolve, reject) { 
    logger.debug('creating checkpoint for filepath: '+filePath);
    logger.debug(lineNumber);
    var mmf = new mavensMateFile.MavensMateFile({ project: self.project, path: filePath });
    self.project.sfdcClient.conn.tooling.sobject('ApexExecutionOverlayAction').create({
      ActionScriptType : 'None',
      ExecutableEntityId : mmf.id,
      IsDumpingHeap : true,
      Iteration : 1,
      Line : lineNumber,
      ScopeId : self.project.sfdcClient.getUserId()
    }, function(err, res) {
      if (err) { 
        reject(err);
      } else {
        resolve(res);
      }
    }); 
  });
};

/**
 * Delete checkpoint at the provided line for the provided file path
 * @param {String} filePath
 * @param {Integer} lineNumber
 * @return {Promise}       
 */
CheckpointService.prototype.deleteCheckpointsForCurrentUser = function() {
  var self = this;
  return new Promise(function(resolve, reject) { 
    logger.debug('deleting checkpoints for current user');
    self.project.sfdcClient.conn.tooling.query('Select Id From ApexExecutionOverlayAction Where ScopeId = \''+self.project.sfdcClient.getUserId()+'\'', function(err, res) {
      if (err) {
        return reject(err);
      } else {
        if (res.size > 0) {
          var ids = [];
          _.each(res.records, function(r) {
            ids.push(r.Id);
          });
          self.project.sfdcClient.conn.tooling.sobject('ApexExecutionOverlayAction').destroy( ids )
            .then(function(deleteResult) {
              return resolve(deleteResult);
            })
            .catch(function(err) {
              reject(err);
            });
        } else {
          resolve();
        }
      }
    });
    
  });
};

/**
 * Delete checkpoint at the provided line for the provided file path
 * @param {String} filePath
 * @param {Integer} lineNumber
 * @return {Promise}       
 */
CheckpointService.prototype.deleteCheckpoint = function(filePath, lineNumber) {
  var self = this;
  return new Promise(function(resolve, reject) { 
    logger.debug('deleting checkpoint');
    var mmf = new mavensMateFile.MavensMateFile({ project: self.project, path: filePath });
    self.project.sfdcClient.conn.tooling.query('Select Id From ApexExecutionOverlayAction Where ExecutableEntityId = \''+mmf.id+'\' AND ScopeId = \''+self.project.sfdcClient.getUserId()+'\' AND Line = '+lineNumber+'', function(err, res) {
      logger.debug(err);
      logger.debug(res);
      if (err) {
        return reject(err);
      } else {
        if (res.size > 0) {
          self.project.sfdcClient.conn.tooling.sobject('ApexExecutionOverlayAction').destroy( res.records[0].Id )
            .then(function(deleteResult) {
              return resolve(deleteResult);
            })
            .catch(function(err) {
              reject(err);
            });
        } else {
          resolve();
        }
      }
    });
    
  });
};

/**
 * List checkpoints for the provided filepath
 * @return {Promise}       
 */
CheckpointService.prototype.listCheckpoints = function(filePath) {
  var self = this;
  return new Promise(function(resolve, reject) { 
    logger.debug('listing checkpoints for filePath: '+filePath);
    var mmf = new mavensMateFile.MavensMateFile({ project: self.project, path: filePath });
    self.project.sfdcClient.conn.tooling.query('Select Id From ApexExecutionOverlayAction Where ExecutableEntityId = \''+mmf.id+'\' AND ScopeId = \''+self.project.sfdcClient.getUserId()+'\'', function(err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
};


module.exports = CheckpointService;