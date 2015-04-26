'use strict';

var fs                = require('fs-extra');
var path              = require('path');
var Promise           = require('bluebird');
var logger            = require('winston');
var MetadataHelper    = require('./metadata').MetadataHelper;
var LightningService  = require('./lightning');
var Package           = require('./package').Package;
var util              = require('./util').instance;
var find              = require('findit');
var temp              = require('temp');
var mavensMateFile    = require('./file');

/**
 * Responsible for refreshing local copies of files/directories from the server
 * @param {Project} project - project instance (required)
 * @param {Array} paths - array of path strings [ 'foo/bar/src/classes', 'foo/bar/src/pages/foo.page' ]
 */
var RefreshDelegate = function(project, paths) {
  if (!project || !paths) {
    throw new Error('RefreshDelegate requires a valid project instance and an array of paths to refresh.');
  }
  this.project = project;
  this.paths = paths;
  this.metadataHelper = new MetadataHelper({ sfdcClient : this.project.sfdcClient });
};

/**
 * Executes refresh and overwrite for all delegate paths
 * @return {Promise}
 * TODO: handle src
 */
RefreshDelegate.prototype.execute = function() {
  // TODO: implement stash
  var self = this;
  return new Promise(function(resolve, reject) {
    self._refreshLocalPaths()
      .then(function(res) {
        resolve(res);
      })
      .catch(function(err) {
        // TODO: revert via stash
        logger.debug('Could not complete refresh request: '+err.message);
        reject(err);
      });
  });  
};

/**
 * Retrieves source of metadata via retrieve
 * @param  {Array} metadata - array of Metadata instances
 * @return {Promise}
 */
RefreshDelegate.prototype._refreshLocalPaths = function() {
  // 1. get subscription for that path
  // 2. create retrieve request
  // 3. overwrite!
  // 
  
  // [
  //   'foo/bar/src/classes', -> 'TOP_LEVEL_METADATA_DIRECTORY'
  //   'foo/bar/src/pages/mypage.page', -> 'TOP_LEVEL_METADATA_FILE'
  //   'foo/bar/src/documents/myfolder', -> 'METADATA_FOLDER'
  //   'foo/bar/src/email/myemailfolder/myemail.email', -> 'METADATA_FOLDER_ITEM'
  //   'foo/bar/src/aura/mylightningbundle', -> 'LIGHTNING_BUNDLE'
  //   'foo/bar/src/aura/mylightningbundle/mylightningbundleController.js' -> 'LIGHTNING_BUNDLE_ITEM'
  // ]
  // 
  // top-level directories (foo/bar/src/classes) can be refreshed more easily
  // foo/bar/src/classes -> ApexClass -> look for ApexClass subscription in project package -> add to retrieve package
  // 
  // top-level files (foo/bar/src/pages/mypage.page) can be refresh easily
  // foo/bar/src/pages/mypage.page -> ApexPage -> add mypage.page to ApexPage subscription in retrieve package
  // 
  // sub-directories (foo/bar/src/documents/myfolder) are more difficult
  
  var self = this;
  return new Promise(function(resolve, reject) {
    if (self.paths.length === 0) {
      return resolve();
    }

    // first we get a list of types we're refreshing
    // foo/bar/src/classes -> ApexClass
    // foo/bar/src/documents/myfolder -> Document
    // once we have the types we're refreshing [ 'ApexClass', 'Document' ], we can figure out what the subscription is for those types
    // so we look at the packagexml and create a retrieval package:
    // {
    //   ApexClass : '*',
    //   Document : ['myfolder', 'myfolder/myfile', 'myotherfolder', 'myotherfolder/myfile']
    // }
    
    var files = mavensMateFile.createFileInstances(self.paths);
    var lightningBundleItemFiles = mavensMateFile.getLightningBundleItemFiles(files);
    var refreshSubscription = mavensMateFile.createPackageSubscription(files, self.project.packageXml);

    // now we perform the retrieve
    var newPath = temp.mkdirSync({ prefix: 'mm_' });
    var retrievePath = path.join(newPath, 'unpackaged');
    fs.mkdirsSync(retrievePath);
    var fileProperties;
    var retrieveResultStream;
    var pkg = new Package({ subscription: refreshSubscription });
    pkg.init()
      .then(function() {
        logger.debug('submitting retrieve request for pkg metadata');
        logger.debug(pkg.subscription);
        return self.project.sfdcClient.retrieveUnpackaged(pkg.subscription);
      })
      .then(function(retrieveResult) {
        retrieveResultStream = retrieveResult.zipStream;
        fileProperties = retrieveResult.fileProperties;
        return util.writeStream(retrieveResultStream, newPath);
      })
      .then(function() {
        return self.project.updateLocalStore(fileProperties);
      })
      .then(function() {
        // TODO: handle packaged
        var finder = find(retrievePath);
        finder.on('file', function (file) { 
          var fileBasename = path.basename(file);
          if (fileBasename !== 'package.xml') {
            // file => /foo/bar/myproject/unpackaged/classes/myclass.cls

            logger.debug('refreshing file: '+file);

            var directory = path.dirname(file); //=> /foo/bar/myproject/unpackaged/classes
            var destinationDirectory = directory.replace(retrievePath, path.join(self.project.workspace, self.project.name, 'src')); //=> /foo/bar/myproject/src/classes

            // make directory if it doesnt exist (parent dirs included)
            if (!fs.existsSync(destinationDirectory)) {
              fs.mkdirpSync(destinationDirectory); 
            }

            // remove project metadata, replace with recently retrieved
            fs.removeSync(path.join(destinationDirectory, fileBasename));
            fs.copySync(file, path.join(destinationDirectory, fileBasename));
          }
        });
        finder.on('end', function () {
          // remove retrieved
          // TODO: package support
          if (fs.existsSync(retrievePath)) {
            fs.removeSync(retrievePath);
          }
          resolve();
        });
        finder.on('error', function (err) {
          logger.debug('Could not process retrieved metadata: '+err.message);
          reject(err);
        });
      })
      .catch(function(err) {
        logger.debug('Could not refresh metadata: '+err.message);
        reject(err);
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
RefreshDelegate.prototype._retrieveAndOverwriteLightningMetadata = function(lightningMetadata) {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (lightningMetadata.length === 0) {
      return resolve();
    }

    logger.debug('refreshing lightning components');
    logger.debug(lightningMetadata[0].path);

    var lightningService = new LightningService(self.project);
    lightningService.getBundleItems(lightningMetadata)
      .then(function(result) {   
        // console.log('result from getting bundle items: ');
        // console.log(result);
        resolve(result);
        // todo : overwrite
      })
      .catch(function(err) {
        reject(err);
      })
      .done();
  });
};

module.exports = RefreshDelegate;