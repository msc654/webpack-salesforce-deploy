'use strict';

var Promise           = require('bluebird');
var _                 = require('lodash');
var logger            = require('winston');
var LightningService  = require('./lightning');
var Deploy            = require('./deploy');
var fs                = require('fs-extra');
var util              = require('./util').instance;
var path              = require('path');
var MetadataHelper    = require('./metadata').MetadataHelper;
var mavensMateFile    = require('./file');

/**
 * Responsible for deleting server and local copies of files/directories 
 * @param {Project} project - project instance (required)
 * @param {Array} paths - array of path strings [ 'foo/bar/src/classes', 'foo/bar/src/pages/foo.page' ]
 */
var DeleteDelegate = function(project, paths) {
  if (!project || !paths) {
    throw new Error('DeleteDelegate requires a valid project instance and an array of paths to delete.');
  }
  this.project = project;
  this.paths = paths;
  this.metadataHelper = new MetadataHelper({ sfdcClient : this.project.sfdcClient });
};

/**
 * Executes local and server delete for all delegate paths
 * @return {Promise}
 */
DeleteDelegate.prototype.execute = function() {
  // TODO: implement stash
  var self = this;
  return new Promise(function(resolve, reject) {
    _.each(self.paths, function(p) {
      if (!fs.existsSync(p)) {
        return reject(new Error('Invalid delete request. Path does not exist: '+p));
      }
    });

    self._performDelete()
      .then(function(deleteResult) {
        self._deleteEmptyProjectDirectories();
        resolve(deleteResult);
      })
      .catch(function(err) {
        // TODO: revert via stash
        reject(err);
      });
  });  
};

DeleteDelegate.prototype._deleteEmptyProjectDirectories = function() {
  var self = this;
  fs.readdirSync(path.join(self.project.path, 'src')).filter(function(res) {
    if (fs.statSync(path.join(self.project.path, 'src', res)).isDirectory()) {
      if (util.isDirectoryEmptySync(path.join(self.project.path, 'src', res))) {
        try {
          fs.removeSync(path.join(self.project.path, 'src', res));
        } catch(e) {
          logger.debug('Could not delete '+path.join(self.project.path, 'src', res)+': '+e.message);
        }
      }
    }
  });
};

DeleteDelegate.prototype._performDelete = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (self.paths.length === 0) {
      return resolve();
    }

    var files = mavensMateFile.createFileInstances(self.paths);
    var lightningBundleItemFiles = mavensMateFile.getLightningBundleItemFiles(files);
    var deleteSubscription = mavensMateFile.createPackageSubscription(files, self.project.packageXml);

    var result = {};
    var deploy = new Deploy({ project: self.project });
    deploy.stageDelete(deleteSubscription)
      .then(function(zipStream) {
        return deploy.executeStream(zipStream);
      })
      .then(function(res) {
        result = res;
        logger.debug('Deletion result via metadata API: '+ JSON.stringify(result));
        if (result.success && result.status === 'Succeeded') {
          logger.debug('deleting paths locally');
          _.each(files, function(sp) {
            logger.debug('deleting: '+sp.path);
            sp.deleteLocally();
          });
        }
        if (!result.details.componentSuccesses) {
          result.details.componentSuccesses = [];
        }
        if (!result.details.componentFailures) {
          result.details.componentFailures = [];
        }
        return self._deleteLightningBundleItemFiles(lightningBundleItemFiles);
      })
      .then(function(res) {
        if (res) {
          _.each(res, function(r) {
            if (!r.success) {
              result.numberComponentErrors++;
              result.componentFailures.push(r);
            } else {
              result.numberComponentsDeployed++;
              result.componentSuccesses.push(r);
            }
            result.numberComponentsTotal++;
          });
          if (!_.find(res, { 'success': false })) {
            _.each(lightningBundleItemFiles, function(sp) {
              sp.deleteLocally();
            }); 
            if (res.status === 'Succeeded' && res.success) {
              res.status = 'Failed';
              res.success = false;
            } 
          }
        }
        // console.log(result);
        logger.debug(JSON.stringify(result));
        resolve(result);
      })
      .catch(function(error) {
        reject(error);
      })
      .done();        
  });
};

/**
 * Retrieves source of lightning bundle items, overwrite local copies
 * @param  {Array} lightningMetadata - array of Metadata of type Lightning
 * @return {Promise}
 * TODO: overwrite local copies
 */
DeleteDelegate.prototype._deleteLightningBundleItemFiles = function(lightningFiles) {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (lightningFiles.length === 0) {
      return resolve();
    }

    logger.debug('deleting lightning components');
    logger.debug(lightningFiles[0].path);

    var lightningService = new LightningService(self.project);
    lightningService.deleteBundleItems(lightningFiles)
      .then(function(result) {   
        logger.debug('delete result: ');
        logger.debug(result);
        resolve(result);
      })
      .catch(function(error) {
        reject(error);
      })
      .done();
  });
};

module.exports = DeleteDelegate;