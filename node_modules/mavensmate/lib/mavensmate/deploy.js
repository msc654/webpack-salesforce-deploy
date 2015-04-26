'use strict';
var Promise           = require('bluebird');
var _                 = require('lodash');
var temp              = require('temp');
var swig              = require('swig');
var fs                = require('fs-extra');
var path              = require('path');
var util              = require('./util').instance;
var events            = require('events');
var inherits          = require('inherits');
var SalesforceClient  = require('./sfdc-client');
var Package           = require('./package').Package;
var MetadataHelper    = require('./metadata').MetadataHelper;
var logger            = require('winston');
var config            = require('./config');
var mavensMateFile    = require('./file');

// TODO: create tmp directory on instantiation, set as property
// TODO: refactor execute... methods

/**
 * Represents a deployment to one or more Salesforce.com servers
 * @param {Object} opts
 * @param {Array} opts.project - Project instance
 * @param {Array} opts.sfdcClient - Sfdc Client instance
 * @param {Array} opts.destinations - array of org connections
 * @param {Array} opts.checkOnly - whether this is a validate-only deployment
 * @param {Array} opts.runTests - whether to run tests during this deployment
 * @param {Array} opts.rollbackOnError - whether to rollback when the deployment fails
 * @param {Array} opts.package - deployment payload
 * @param {Array} opts.newDeploymentName - the name of the deployment to be saved for future deploys
 * @param {Array} opts.debugCategories - array of debug categories for the deployment
 */
function Deploy(opts) {
  util.applyProperties(this, opts);
  this.sfdcClient = this.project ? this.project.sfdcClient : this.sfdcClient;
  this.metadataHelper = new MetadataHelper({ sfdcClient: this.sfdcClient });
}

inherits(Deploy, events.EventEmitter);

Deploy.prototype._getTargets = function() {
  return this.destinations || [];
};

/**
 * Compiles files via Metadata API
 * @param  {Array of Metadata} metadata - metadata to be compiled (must already exist in salesforce)
 * @return {Promise}
 */
Deploy.prototype.compileWithMetadataApi = function(files, subscription) {
  var self = this;
    return new Promise(function(resolve, reject) {

    logger.debug('compiling metadata via metadata api: ');
    // logger.debug(metadata);

    self.stage(files, subscription)
      .then(function(zipStream) {
        return self.project.sfdcClient.deploy(zipStream, { rollbackOnError : true });
      })
      .then(function(result) {
        logger.debug('Compile result: ');
        logger.debug(result);
        resolve(result);
      })
      .catch(function(error) {
        reject(error);
      })
      .done(); 
  });
};

Deploy.prototype.executeRemote = function(deployOptions) {
  var self = this;
  return new Promise(function(resolve, reject) {
    var deployPromises = [];
    deployOptions = deployOptions || {
      rollbackOnError: true,
      performRetrieve: true
    };
    
    var newPath = temp.mkdirSync({ prefix: 'mm_' });
    var retrieveResultStream;
    // var fileProperties;
    self.project.sfdcClient.retrieveUnpackaged(self.package)
      .then(function(retrieveResult) {
        retrieveResultStream = retrieveResult.zipStream;
        // fileProperties = retrieveResult.fileProperties;
        return util.writeStream(retrieveResultStream, newPath);
      })
      .then(function() {
        _.each(self._getTargets(), function(target) {
          logger.debug('adding compare target: ');
          logger.debug(target);
          logger.debug(deployOptions);
          deployPromises.push(self._deployToTarget(target, newPath, deployOptions));
        });
        return Promise.all(deployPromises);
      })
      .then(function(deployResults) {
        var result = {};
        _.each(deployResults, function(deployResult) {
          var username = Object.keys(deployResult)[0];
          result[username] = deployResult[username];
          if (result[username].details.componentFailures) {
            if (!_.isArray(result[username].details.componentFailures)) {
              result[username].details.componentFailures = [result[username].details.componentFailures];
            }
          }
          if (result[username].details.componentSuccesses) {
            if (!_.isArray(result[username].details.componentSuccesses)) {
              result[username].details.componentSuccesses = [result[username].details.componentSuccesses];
            }
          }
          if (result[username].details.runTestResult && result[username].details.runTestResult.codeCoverageWarnings) {
            if (!_.isArray(result[username].details.runTestResult.codeCoverageWarnings)) {
              result[username].details.runTestResult.codeCoverageWarnings = [result[username].details.runTestResult.codeCoverageWarnings];
            }
          }
        });
        resolve(result);
      })
      .catch(function(err) {
        logger.debug('Could not complete deployment: '+err.message);
        reject(err);
      })
      .done();
  });
};

/**
 * Takes an array of Metadata instances and prepares a local deployment zip to be passed to the Metadata API for deployment
 * @param  {Array} of type Metadata - metadata
 * @return {Promise} resolves with zip stream
 */
Deploy.prototype.stage = function(files, subscription) {
  var self = this;
  return new Promise(function(resolve, reject) {

    // TODO: handle folder-based metadata, like documents, templates
    // recurse upward looking for valid folder name, if reach path.join(workspace, projectname), then not valid?

    // writes temp directory, puts zip file inside
    var newPath = temp.mkdirSync({ prefix: 'mm_' });
    fs.mkdirpSync(path.join(newPath, 'unpackaged'));

    var pkg = new Package({ subscription: subscription });
    pkg.init()
      .then(function() {
        pkg.path = path.join(newPath, 'unpackaged', 'package.xml');
        pkg.writeFileSync();

        _.each(files, function(f) {
          
          logger.debug('STAGING: '+f.path);
          var filePath = f.path;
          // filePath => /foo/bar/myproject/unpackaged/classes/myclass.cls

          var fileBasename = path.basename(filePath);
          // fileBaseName => myclass.cls

          logger.debug('fileBasename: '+fileBasename);

          var directory = path.dirname(filePath); 
          // directory => /foo/bar/myproject/unpackaged/classes
          
          logger.debug('directory: '+directory);

          var projectSrc = path.join(self.project.workspace, self.project.name, 'src');
          var destinationDirectory = directory.replace(projectSrc, path.join(newPath, 'unpackaged')); 
          // destinationDirectory => /foo/bar/myproject/unpackaged/classes

          logger.debug('destinationDirectory: '+destinationDirectory);

          // make directory if it doesnt exist (parent dirs included)
          if (!fs.existsSync(destinationDirectory)) {
            fs.mkdirpSync(destinationDirectory); 
          }

          // copy to tmp
          fs.copySync(filePath, path.join(destinationDirectory, fileBasename));

          if (f.hasMetaFile) {
            if (f.isMetaFile) {
              fs.copySync(filePath.replace('-meta.xml',''), path.join(destinationDirectory, fileBasename.replace('-meta.xml', '')));
            } else {
              fs.copySync(filePath+'-meta.xml', path.join(destinationDirectory, fileBasename+'-meta.xml'));
            }
          }
        }); 
        return util.zipDirectory(path.join(newPath, 'unpackaged'), newPath);
      })
      .then(function() {
        var zipStream = fs.createReadStream(path.join(newPath, 'unpackaged.zip'));
        resolve(zipStream);  
      })
      .catch(function(err) {
        logger.debug('Could not prepare metadata for deployment: '+err.message);
        reject(err);
      })
      .done();
  });
};

/**
 * Deploys zipStream to project's sfdcClient
 * @param  {Stream} zipStream - zipped deployment 
 * @return {[type]}           [description]
 */
Deploy.prototype.executeStream = function(zipStream) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.project.sfdcClient.deploy(zipStream, { rollbackOnError : true })
      .then(function(result) {
        resolve(result);
      })
      .catch(function(error) {
        reject(error);
      })
      .done(); 
  });
};

// TODO: CHANGE METADATA TO FILE!!!

/**
 * Deploys file instance to server, creating a server copy, places in self.project
 * @return {Promise} - resolves with Object response from Salesforce
 */
Deploy.prototype.execute = function(file, deployOptions) {
  var self = this;
  return new Promise(function(resolve, reject) {

    if (!deployOptions) {
      deployOptions = {
        rollbackOnError: true
      };
    }

    var newPath = temp.mkdirSync({ prefix: 'mm_' });
    logger.debug('deploying file: ');

    var pkg = new Package({ subscription: mavensMateFile.createPackageSubscription([file]) });
    pkg.init()
      .then(function() {
        pkg.path = path.join(newPath, 'unpackaged', 'package.xml');
        pkg.writeFileSync();
        return file.renderAndWriteToDisk(path.join(newPath, 'unpackaged'));
      })
      .then(function() {
        return util.zipDirectory(path.join(newPath, 'unpackaged'), newPath);
      })
      .then(function() {
        var zipStream = fs.createReadStream(path.join(newPath, 'unpackaged.zip'));
        return self.project.sfdcClient.deploy(zipStream, deployOptions);
      })
      .then(function(result) {
        logger.debug('Creation result: ');
        logger.debug(result);
        if (result.success) {
          var metadataPath = path.join(newPath, 'unpackaged', file.type.directoryName, file.name+'.'+file.type.suffix);
          // metadataPath => /my/tmp/directory/unpackaged/classes/myclass.cls

          var fileBasename = path.basename(metadataPath);
          // fileBaseName => myclass.cls

          var directory = path.dirname(metadataPath); 
          // directory => /my/tmp/directory/unpackaged/classes
          
          var projectSrc = path.join(self.project.workspace, self.project.name, 'src');
          // projectSrc => /foo/bar/myproject/src

          var destinationDirectory = directory.replace(path.join(newPath, 'unpackaged'), projectSrc); 
          // destinationDirectory => /foo/bar/myproject/src/classes

          // make directory if it doesnt exist (parent dirs included)
          if (!fs.existsSync(destinationDirectory)) {
            fs.mkdirpSync(destinationDirectory); 
          }

          // copy to project
          // console.log(metadataPath);
          // console.log(path.join(destinationDirectory, fileBasename));
          fs.copySync(metadataPath, path.join(destinationDirectory, fileBasename));

          if (file.hasMetaFile) {
            fs.copySync(metadataPath+'-meta.xml', path.join(destinationDirectory, fileBasename+'-meta.xml'));
          }  
        }
        resolve(result);
      })
      .catch(function(error) {
        logger.debug('Error deploying new file to server');
        logger.debug(error.stack);
        reject(error);
      })
      .done();           
  });
};

Deploy.prototype._deployToTarget = function(target, deployPath, deployOptions) {
  var self = this;
  return new Promise(function(resolve, reject) {
    logger.debug('deploying to target: ');
    logger.debug(target);

    // if using keyring, retrieve password (otherwise it will be a property of the target)
    if (!target.password) {
      target.password = self.project.keychainService.getPassword(target.id);
    }

    logger.debug('READY TO DEPLOY: ');
    logger.debug(target.username);
    logger.debug(target.password);
    logger.debug('deploy options:');
    logger.debug(deployOptions);
    
    var deployClient;
    var deployStream;

    util.zipDirectory(path.join(deployPath, 'unpackaged'), deployPath)
      .then(function() {
        deployClient = new SalesforceClient({ username: target.username, password: target.password });
        return deployClient.initialize();
      })
      .then(function() {
        deployClient.setPollingTimeout(300000); // TODO: make configurable from UI
        deployStream = fs.createReadStream(path.join(deployPath, 'unpackaged.zip'));
        return deployClient.deploy(deployStream, deployOptions);
      })
      .then(function(deployResult) {
        var result = {};
        result[target.username] = deployResult;
        resolve(result);
      }) 
      .catch(function(err) {
        logger.debug('_deployToTarget failed: '+target.username+', '+err.message);
        logger.debug(err);
        reject(err);
      })
      .done();
  });
};

/**
 * Takes an array of Metadata instances and prepares a local deployment zip to be passed to the Metadata API for deletion
 * @param  {Array} of type Metadata - metadata
 * @return {Promise} resolves with zip stream
 */
Deploy.prototype.stageDelete = function(subscription) {
  return new Promise(function(resolve, reject) {
    // TODO: handle folder-based metadata, like documents, templates
    // recurse upward looking for valid folder name, if reach path.join(workspace, projectname), then not valid?

    // writes temp directory, puts zip file inside
    var newPath = temp.mkdirSync({ prefix: 'mm_' });

    fs.mkdirpSync(path.join(newPath, 'unpackaged'));

    var pkg = new Package({ subscription: subscription });
    var emptyPackage = new Package({ subscription: {} });  
    pkg.init()
      .then(function() {
        pkg.path = path.join(newPath, 'unpackaged', 'destructiveChanges.xml');
        pkg.writeFileSync();
        emptyPackage = new Package({ subscription: {} });  
        return emptyPackage.init();
      })
      .then(function() {      
        emptyPackage.path = path.join(newPath, 'unpackaged', 'package.xml');
        emptyPackage.writeFileSync();
        return util.zipDirectory(path.join(newPath, 'unpackaged'), newPath);
      })
      .then(function() {
        var zipStream = fs.createReadStream(path.join(newPath, 'unpackaged.zip'));
        resolve(zipStream);  
      })
      .catch(function(err) {
        logger.debug('Could not prepare metadata for deletion: '+err);
        reject(err);
      })
      .done();
  });
};


module.exports = Deploy;