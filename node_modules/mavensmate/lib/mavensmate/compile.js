'use strict';

var Promise           = require('bluebird');
var _                 = require('lodash');
var logger            = require('winston');
var config            = require('./config');
var LightningService  = require('./lightning');
var MetadataHelper    = require('./metadata').MetadataHelper;
var Deploy            = require('./deploy');
var fs                = require('fs-extra');
var mavensMateFile    = require('./file');
var config            = require('./config');
var moment            = require('moment');

/**
 * Responsible for compiling local copies of files/directories 
 * @param {Project} project - project instance (required)
 * @param {Array} paths - array of path strings [ 'foo/bar/src/classes', 'foo/bar/src/pages/foo.page' ]
 */
var CompileDelegate = function(project, paths, force) {
  if (!project || !paths) {
    throw new Error('CompileDelegate requires a valid project instance and an array of paths to compile.');
  }
  this.project = project;
  this.paths = paths;
  this.force = force;
  this.metadataHelper = new MetadataHelper({ sfdcClient : this.project.sfdcClient });
};

// we standardize the result output to match that of the metadata api compilation/deploy response
// 
// { checkOnly: false,
//   completedDate: '2015-01-19T23:55:03.000Z',
//   createdBy: '005o0000000TB1i',
//   createdByName: 'Joseph Ferraro',
//   createdDate: '2015-01-19T23:55:03.000Z',
//   details:
//    { componentSuccesses: [ [Object], [Object], [Object] ],
//      runTestResult: { numFailures: '0', numTestsRun: '0', totalTime: '0.0' },
//      componentFailures: [] },
//   done: true,
//   id: '0Afo000000Ft2NbCAJ',
//   ignoreWarnings: false,
//   lastModifiedDate: '2015-01-19T23:55:03.000Z',
//   numberComponentErrors: 0,
//   numberComponentsDeployed: 2,
//   numberComponentsTotal: 2,
//   numberTestErrors: 0,
//   numberTestsCompleted: 0,
//   numberTestsTotal: 0,
//   rollbackOnError: true,
//   runTestsEnabled: 'false',
//   startDate: '2015-01-19T23:55:03.000Z',
//   status: 'Succeeded',
//   success: true }

/**
 * Executes local and server compile for all delegate paths
 * @return {Promise}
 */
CompileDelegate.prototype.execute = function() {
  // TODO: implement stash
  var self = this;
  return new Promise(function(resolve, reject) {
    self._performCompile()
      .then(function(compileResults) {
        resolve(self._flattenResults(compileResults));
      })
      .catch(function(err) {
        reject(err);
      });
  });  
};

CompileDelegate.prototype._flattenResults = function(compileResults) {
  var result = {
    checkOnly: false,
    completedDate: '',
    createdBy: '',
    createdByName: '',
    createdDate: '',
    details:
     { componentSuccesses: [],
       runTestResult: { numFailures: '0', numTestsRun: '0', totalTime: '0.0' },
       componentFailures: [] 
     },
    done: false,
    id: '',
    ignoreWarnings: false,
    lastModifiedDate: '',
    numberComponentErrors: 0,
    numberComponentsDeployed: 0,
    numberComponentsTotal: 0,
    numberTestErrors: 0,
    numberTestsCompleted: 0,
    numberTestsTotal: 0,
    rollbackOnError: false,
    runTestsEnabled: 'false',
    startDate: '',
    status: '',
    success: true };

  logger.debug('flattening results: ');

  _.each(compileResults, function(res) {
    logger.debug('compile result:');
    logger.debug(res);

    if (_.has(res, 'runTestsEnabled')) {
      // this is metadata api result
      result = res;
    } else if (_.has(res, 'hasConflict') && !res.success) {
      result.details.conflicts = res.conflicts;
      result.status = 'Conflict';
      result.success = false;
      result.done = true;
    } else if (_.isArray(res)) {
      _.each(res, function(r) {
        if (_.has(r, 'State')) {
          // tooling result
          if (r.State === 'Completed') {
            result.numberComponentsDeployed++;
            result.details.componentSuccesses.push(r);
          } else {
            result.numberComponentErrors++;
            result.details.componentFailures.push(r);
            result.success = false;
          }
        }
      });
    }
  });

  logger.debug('compile results: ');
  logger.debug(JSON.stringify(result));
  return result;
};

CompileDelegate.prototype._performCompile = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (self.paths.length === 0) {
      return resolve();
    }

    logger.debug('compiling paths: ');
    logger.debug(self.paths);

    var compileWithToolingApi = config.get('mm_compile_with_tooling_api');
    var files = mavensMateFile.createFileInstances(self.paths, self.project);
    var lightningBundleItemFiles = mavensMateFile.getLightningBundleItemFiles(files);
    var toolingFiles = mavensMateFile.getToolingFiles(files, !compileWithToolingApi);
    var metadataApiFiles = mavensMateFile.getMetadataApiFiles(files, compileWithToolingApi);
    var compileSubscription = mavensMateFile.createPackageSubscription(files, self.project.packageXml, compileWithToolingApi);

    var compilePromises = [];

    if (metadataApiFiles.length > 0) {
      compilePromises.push(self._compileGenericMetadata(metadataApiFiles, compileSubscription));
    }

    if (toolingFiles.length > 0) {
      compilePromises.push(self._compileToolingFiles(toolingFiles));
    }

    if (lightningBundleItemFiles.length > 0) {
      compilePromises.push(self._compileLightningBundleItemFiles(lightningBundleItemFiles));
    }

    Promise.all(compilePromises)
      .then(function(res) {
        resolve(res);
      })
      .catch(function(err) {
        // TODO: revert via stash
        reject(err);
      });
  });
};

CompileDelegate.prototype._compileToolingFiles = function(toolingFiles) {
  var self = this;
  return new Promise(function(resolve, reject) {
    logger.debug('compiling via tooling api');
    var toolingFilesPayload = [];
    _.each(toolingFiles, function(tf) {
      if (tf.isDirectory) {
        // get directory contents
        toolingFilesPayload = toolingFilesPayload.concat(tf.localMembers);
      } else {
        toolingFilesPayload.push(tf);
      }
    });

    self._checkConflicts(toolingFilesPayload)
      .then(function(conflictCheckResult) {
        if (conflictCheckResult.hasConflict) {
          return resolve(conflictCheckResult);
        } else {
          self.project.sfdcClient.compileWithToolingApi(toolingFilesPayload, self.project)
            .then(function(result) {
              logger.debug('compile via tooling api result: ');
              logger.debug(result);
              resolve(result);
            })
            .catch(function(error) {
              reject(error);
            })
            .done();
        }
      })
      .catch(function(error) {
        reject(error);
      })
      .done();
  });
};

/**
 * Compiles metadata, will use metadata API or tooling API based on the metadata payload requested
 * @param  {Array} type Metadata - metadata to be compiled (must already exist in salesforce)
 * @return {Promise}
 */
CompileDelegate.prototype._compileGenericMetadata = function(metadataApiFiles, compileSubscription) {
  var self = this;
  return new Promise(function(resolve, reject) {
    logger.debug('compiling via metadata api');
    logger.debug(compileSubscription);

    var metadataApiFilesPayload = [];
    _.each(metadataApiFiles, function(f) {
      if (f.isDirectory) {
        // get directory contents
        metadataApiFilesPayload = metadataApiFilesPayload.concat(f.localMembers);
      } else {
        metadataApiFilesPayload.push(f);
      }
    });

    self._checkConflicts(metadataApiFilesPayload)
      .then(function(conflictCheckResult) {
        if (conflictCheckResult.hasConflict) {
          return resolve(conflictCheckResult);
        } else {
          var deploy = new Deploy({ project: self.project });
          deploy.compileWithMetadataApi(metadataApiFilesPayload, compileSubscription)
            .then(function(result) {
              logger.debug('compile via metadata api result: ');
              logger.debug(result);
              resolve(result);
            })
            .catch(function(error) {
              reject(error);
            })
            .done();
        }
      })
      .catch(function(error) {
        reject(error);
      })
      .done();
  });
};

/**
 * Compiles metadata, will use metadata API or tooling API based on the metadata payload requested
 * @param  {Array} type Metadata - metadata to be compiled (must already exist in salesforce)
 * @return {Promise}
 */
CompileDelegate.prototype._compileLightningBundleItemFiles = function(files) {
  var self = this;
  return new Promise(function(resolve, reject) {
    var lightningService = new LightningService(self.project);
    lightningService.update(files)
      .then(function(result) {   
        logger.debug('compile lightning result: ');
        logger.debug(result);
        resolve(result);
      })
      .catch(function(error) {
        reject(error);
      })
      .done();
  });
};

/**
 * Checks for conflict between local copy and server copy
 * @param  {Array} files - array of MavensMateFiles
 * @return {Promise}
 */
CompileDelegate.prototype._checkConflicts = function(files) {
  var self = this;
  return new Promise(function(resolve, reject) {
    try {
      if (!config.get('mm_compile_check_conflicts') || self.force) {
        return resolve({ hasConflict: false });
      }

      logger.debug('checking for conflicts');

      var result = { hasConflict: false };
      var conflicts = {};

      var serverCopyPromises = [];
      _.each(files, function(f) {
        if (f.isToolingType) {
          serverCopyPromises.push( f.serverCopy );          
        }
      });

      if (serverCopyPromises.length === 0) {
        return resolve({ hasConflict: false });
      }

      Promise.all(serverCopyPromises)
        .then(function(serverCopyResults) {
          _.each(files, function(f, i) {
            // logger.debug('local copy:');
            // logger.debug(f.localStoreEntry);
            // logger.debug('remote copy:');
            // logger.debug(serverCopyResults[i]);

            var localLastModified = moment(f.localStoreEntry.lastModifiedDate);
            var remoteLastModified = moment(serverCopyResults[i].LastModifiedDate);

            if (remoteLastModified.isAfter(localLastModified)) {              
              logger.debug('conflict detected between: ');
              logger.debug(f.localStoreEntry);
              logger.debug(serverCopyResults[i]);
              conflicts[f.basename] = {
                local: f.localStoreEntry,
                remote: serverCopyResults[i]
              };
            }
          });

          if (Object.keys(conflicts).length > 0) {
            result.hasConflict = true;
            result.success = false;
            result.conflicts = conflicts;
          }

          logger.debug('conflict check result:');
          logger.debug(result);

          return resolve(result);
        });
    } catch(e) {
      logger.error('Could not check conflicts: ');
      logger.error(e);
      reject(e);
    }
  });
};

module.exports = CompileDelegate;