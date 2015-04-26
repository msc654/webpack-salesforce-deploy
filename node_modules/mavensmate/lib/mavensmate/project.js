'use strict';
var Promise           = require('bluebird');
var temp              = require('temp');
var _                 = require('lodash');
var fs                = require('fs-extra');
var path              = require('path');
var util              = require('./util').instance;
var uuid              = require('node-uuid');
var SalesforceClient  = require('./sfdc-client');
var MetadataHelper    = require('./metadata').MetadataHelper;
var config            = require('./config');
var logger            = require('winston');
var IndexService      = require('./index');
var Package           = require('./package').Package;
var SymbolService     = require('./symbol');
var LogService        = require('./log');
var LightningService  = require('./lightning');
var KeychainService   = require('./keychain');

/**
 * Represents a MavensMate project
 *
 * @constructor
 * @param {Object} [opts] - Options used in deployment
 * @param {String} [opts.name] - For new projects, sets the name of the project
 * @param {String} [opts.subscription] - (optional) Specifies list of Metadata types that the project should subscribe to
 * @param {String} [opts.workspace] - (optional) For new projects, sets the workspace
 * @param {String} [opts.path] - (optional) Explicitly sets path of the project (defaults to current working directory)
 * @param {Array} [opts.packages] - List of packages
 */
var Project = function(opts) {
  util.applyProperties(this, opts);
  this.keychainService = new KeychainService();
};

Project.prototype._path = null;
Project.prototype._workspace = null;
Project.prototype._name = null;
Project.prototype._session = null;

/**
 * File path of the project
 */
Object.defineProperty(Project.prototype, 'path', {
  get: function() {
    return this._path;
  },
  set: function(value) {
    this._path = value;
  }
});

/**
 * Workspace of the project
 */
Object.defineProperty(Project.prototype, 'workspace', {
  get: function() {
    return this._workspace;
  },
  set: function(value) {
    this._workspace = value;
  }
});

/**
 * Name of the project
 */
Object.defineProperty(Project.prototype, 'name', {
  get: function() {
    return this._name;
  },
  set: function(value) {
    this._name = value;
  }
});

/**
 * Initializes project instance based on whether this is a new or existing project
 * @param  {Boolean} isNewProject
 * @return {Promise}
 */
Project.prototype.initialize = function(isNewProject, isTransient) {
  var self = this;

  return new Promise(function(resolve, reject) {
    isNewProject = isNewProject || false;

    if (!isNewProject) {  
      var initPromise = isTransient ? self._initTransient() : self._initExisting();
      initPromise
        .then(function() {
          self.initialized = true;
          resolve(self);
        })
        .catch(function(error) {
          logger.error('Could not initiate existing Project instance: '+error.message);
          reject(error);
        })
        .done(); 
    } 

    else if (isNewProject) {
      self._initNew()
        .then(function() {
          self.initialized = true;
          resolve(self);
        })
        .catch(function(error) {
          logger.error('Could not initiate new Project instance: '+error.message);
          reject(error);
        })
        .done();
    }
  });
};

/**
 * init command line project (for performance reasons)
 */
Project.prototype._initTransient = function() {
  logger.debug('initing existing TRANSIENT (command-line) project ...');
  
  var self = this;

  return new Promise(function(resolve, reject) {
    if (!self._isValid()) {
      return reject(new Error('This does not seem to be a valid MavensMate project directory.'));
    } else {
      if (self.path !== undefined) {
        self.workspace = path.dirname(self.path);
        self.name = path.basename(self.path);
      } else if (self.workspace !== undefined && self.name !== undefined) {
        self.path = path.join(self.workspace, self.name);
      } else {
        self.path = process.cwd();
        self.workspace = path.dirname(self.path);
        self.name = path.basename(self.path); 
      }

      if (!fs.existsSync(self.path)) {
        return reject(new Error('This does not seem to be a valid MavensMate project directory.'));
      }

      // self.workspace = path.dirname(self.path);
      // self.name = path.basename(self.path);

      // TODO: Promise.all or reduce
      // first order of business is to ensure we have a valid sfdc-client

      self.packageXml = new Package({ path: path.join(self.path, 'src', 'package.xml') });
      self.packageXml.init()
        .then(function() {
          return self._getSettings();          
        })
        .then(function() {
          return self._getCachedSession(); 
        })
        .then(function(cachedSession) {
          cachedSession.username = self.settings.username;
          cachedSession.password = self.settings.password;
          cachedSession.orgType = self.settings.environment;
          self.sfdcClient = new SalesforceClient(cachedSession); 
          self.sfdcClient.on('sfdcclient-cache-refresh', function() {
            logger.debug('project caught event: sfdcclient-cache-refresh');
            self._writeSession()
              .then(self._getCachedSession())
              .catch(function(err) {
                logger.debug('sfdcclient-cache-refresh: could not update local session cache');
                throw new Error('Could not update local session cache: '+err.message);
              })
              .done();
          });
          return self.sfdcClient.initialize();
        })
        .then(function() {
          return self._writeSession();
        })
        .then(function() {
          self.getLocalStore();
          resolve();
        })
        .catch(function(error) {
          reject(error);
        })
        .done();
    }
  });
};

/**
 * Initiates an existing (on disk) MavensMate project instance
 * @return {Promise}
 */
Project.prototype._initExisting = function() {
  logger.debug('initing existing project ...');
  
  var self = this;

  return new Promise(function(resolve, reject) {
    if (!self._isValid()) {
      reject(new Error('This does not seem to be a valid MavensMate project directory.'));
    } else {
      if (self.path !== undefined) {
        self.workspace = path.dirname(self.path);
        self.name = path.basename(self.path);
      } else if (self.workspace !== undefined && self.name !== undefined) {
        self.path = path.join(self.workspace, self.name);
      } else {
        self.path = process.cwd();
        self.workspace = path.dirname(self.path);
        self.name = path.basename(self.path); 
      }

      if (!fs.existsSync(self.path)) {
        return reject(new Error('This does not seem to be a valid MavensMate project directory.'));
      }

      // self.workspace = path.dirname(self.path);
      // self.name = path.basename(self.path);

      // TODO: Promise.all or reduce
      // first order of business is to ensure we have a valid sfdc-client

      self.packageXml = new Package({ path: path.join(self.path, 'src', 'package.xml') });
      self.packageXml.init()
        .then(function() {
          return self._getSettings();          
        })
        .then(function() {
          return self._getCachedSession(); 
        })
        .then(function(cachedSession) {
          cachedSession.username = self.settings.username;
          cachedSession.password = self.settings.password;
          cachedSession.orgType = self.settings.environment;
          self.sfdcClient = new SalesforceClient(cachedSession); 
          self.sfdcClient.on('sfdcclient-cache-refresh', function() {
            logger.debug('project caught event: sfdcclient-cache-refresh');
            self._writeSession()
              .then(self._getCachedSession())
              .catch(function(err) {
                logger.debug('sfdcclient-cache-refresh: could not update local session cache');
                throw new Error('Could not update local session cache: '+err.message);
              })
              .done();
          });
          return self.sfdcClient.initialize();
        })
        .then(function() {
          return self._writeSession();
        })
        .then(function() {
          self.getLocalStore();
          return self.getOrgMetadataIndexWithSelections();
        })
        .then(function() {
          return self._refreshDescribeFromServer();
        })
        .then(function() {
          self.logService = new LogService(self);
          self.sfdcClient.on('sfdcclient-new-log', function(message) {
            if (message.sobject && message.sobject.Id) {
              self.logService.downloadLog(message.sobject.Id)
                .catch(function(error) {
                  logger.debug('Could not download log: '+error.message);
                })
                .done();
            }
          });
          return self.sfdcClient.startSystemStreamingListener();
        })
        .then(function() {
          resolve();
        })
        .catch(function(error) {
          reject(error);
        })
        .done();
    }
  });
};

/**
 * Initiates a new (not yet on disk) MavensMate project instance
 * @return {Promise}
 */
Project.prototype._initNew = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (!self.workspace) {
      var workspace;
      var workspaceSetting = config.get('mm_workspace');
      logger.debug('Workspace not specified, retrieving base workspace: ');
      logger.debug(workspaceSetting);
      if (_.isArray(workspaceSetting)) {
        workspace = workspaceSetting[0];
      } else if (_.isString(workspaceSetting)) {
        workspace = workspaceSetting;
      }
      if (workspace && !fs.existsSync(workspace)) {
        fs.mkdirSync(workspace);
      }
      self.workspace = workspace;
      logger.debug('workspace set to: '+self.workspace);
    } else if (!fs.existsSync(self.workspace)) {
      fs.mkdirSync(self.workspace);
    }
    if (!self.workspace) {
      throw new Error('Could not set workspace for new project');
    }
    self.path = path.join(self.workspace, self.name);
    if (fs.existsSync(self.path)) {
      reject(new Error('Directory already exists!'));
    } else {
      self.id = uuid.v1();
      resolve(self.id);
    }
  });
};

Project.prototype._isValid = function() {
  if (this.path !== undefined) {
    return fs.existsSync(path.join(this.path, 'config', '.settings'));
  } else if (this.workspace !== undefined && this.name !== undefined) {
    return fs.existsSync(path.join(this.workspace, this.name, 'config', '.settings'));
  } else {
    return fs.existsSync(path.join(process.cwd(),'config', '.settings'));
  }
};

/**
 * Performs a Salesforce.com retrieve based on the type of project being requested,
 * create necessary /config, places on the disk in the correct workspace 
 * @return {Promise}
 */
Project.prototype.retrieveAndWriteToDisk = function() {
  var self = this;

  return new Promise(function(resolve, reject) {
    var fileProperties;
    if (fs.existsSync(self.path)) {
      reject(new Error('Project with this name already exists in the specified workspace.'));
    } else {
      if (!self.package) {
        // if user has not specified package, add standard developer objects to package
        self.package = [
          'ApexClass', 'ApexComponent', 'ApexPage', 'ApexTrigger', 'StaticResource'
        ];
      }
      self.sfdcClient.describe()
        .then(function(describe) {
          return self.setDescribe(describe);
        })
        .then(function() {
          return self.sfdcClient.retrieveUnpackaged(self.package);
        })
        .then(function(retrieveResult) {
          var retrieveResultStream = retrieveResult.zipStream;
          fileProperties = retrieveResult.fileProperties;
          self.path = path.join(self.workspace, self.name);
          
          // make project dir, make config dir
          fs.mkdirSync(self.path);
          fs.mkdirSync(path.join(self.path, 'config'));

          // write retrieve result to file system
          return util.writeStream(retrieveResultStream, self.path);
        })
        .then(function() {
          if (fs.existsSync(path.join(self.path, 'unpackaged'))) {
            fs.renameSync(path.join(self.path, 'unpackaged'), path.join(self.path, 'src'));
          }
          // TODO: ensure packages write properly
          return self._initConfig();        
        })
        .then(function() {
          logger.debug('initing local store ... ');
          logger.debug(fileProperties);

          return self._writeLocalStore(fileProperties);
        })
        .then(function() {        
          resolve();
        })
        .catch(function(error) {
          // remove directory from workspace if we encounter an exception along the way
          if (fs.existsSync(self.path)) {
            fs.removeSync(self.path);
          }
          logger.error('Could not retrieve and write project to file system: '+error.message);
          logger.error(error.stack);
          reject(error);
        })
        .done();
    } 
  });
};

/**
 * Writes config/ files
 * @return {Promise} 
 */
Project.prototype._initConfig = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    // todo: should we index apex here?
    var promises = [
      self._writeSettings(),
      self._writeSession(),
      self._writeDebug(),
      self._writeEditorSettings(),
      self._refreshDescribeFromServer(),
      self.indexLightning()
    ];

    Promise.all(promises)
      .then(function() {
        return self._storePassword();
      })
      .then(function() {
        resolve();
      })
      .catch(function(err) {
        logger.error('Could not initiate project config directory -->'+err.message);
        reject(err);
      })
      .done();
  }); 
};

/**
 * Reverts a project to server state based on package.xml
 * TODO: handle packages!
 * @return {Promise}
 */
Project.prototype.clean = function() {
  // TODO: implement stash!
  var self = this;
  return new Promise(function(resolve, reject) {
    var fileProperties;
    self.packageXml = new Package({ path: path.join(self.path, 'src', 'package.xml') });
    self.packageXml.init()
      .then(function() {
        return self.sfdcClient.retrieveUnpackaged(self.packageXml.subscription);        
      })
      .then(function(retrieveResult) {
        var retrieveResultStream = retrieveResult.zipStream;
        fileProperties = retrieveResult.fileProperties;
        // todo: update local store
        return util.writeStream(retrieveResultStream, self.path);
      })
      .then(function() {
        fs.removeSync(path.join(self.path, 'src'));
        if (fs.existsSync(path.join(self.path, 'unpackaged'))) {
          fs.renameSync(path.join(self.path, 'unpackaged'), path.join(self.path, 'src'));
        }
        return self._writeLocalStore(fileProperties);
      })
      .then(function() {
        return self.indexLightning();
      })
      .then(function() {
        resolve();
      })
      .catch(function(err) {
        logger.error('Error cleaning project -->'+err.message);
        reject(err);
      })
      .done(); 
  });
};

/**
 * Compiles projects based on package.xml
 * @return {Promise}
 */
Project.prototype.compile = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    // writes temp directory, puts zip file inside
    var newPath = temp.mkdirSync({ prefix: 'mm_' });
    fs.copy(path.join(self.path, 'src'), path.join(newPath, 'unpackaged'), function(err) {
      if (err) {
        return reject(err);
      } else {
        util.zipDirectory(path.join(newPath, 'unpackaged'), newPath)
          .then(function() {
            var zipStream = fs.createReadStream(path.join(newPath, 'unpackaged.zip'));
            return self.sfdcClient.deploy(zipStream, { rollbackOnError : true });
          })
          .then(function(result) {
            resolve(result);
          })
          .catch(function(error) {
            reject(error);
          })
          .done(); 
      }  
    });
  });
};

/**
 * Edits project based on provided payload (should be a JSON package)
 * @param  {Object} payload
 * @return {Promise}
 */
Project.prototype.edit = function(pkg) {
  // TODO: implement stash!
  var self = this;
  return new Promise(function(resolve, reject) {
    var fileProperties;
    var newPackage;
    logger.debug('requested package is: ', pkg);
    self.sfdcClient.retrieveUnpackaged(pkg)
      .then(function(retrieveResult) {
        var retrieveResultStream = retrieveResult.zipStream;
        fileProperties = retrieveResult.fileProperties;
        return util.writeStream(retrieveResultStream, self.path);
      })
      .then(function() {
        fs.removeSync(path.join(self.path, 'src'));
        if (fs.existsSync(path.join(self.path, 'unpackaged'))) {
          fs.renameSync(path.join(self.path, 'unpackaged'), path.join(self.path, 'src'));
        }
        return self._writeLocalStore(fileProperties);
      })
      .then(function() {
        newPackage = new Package({ path: path.join(self.path, 'src', 'package.xml') });
        return newPackage.init();
      })
      .then(function() {
        self.packageXml = newPackage;
        resolve();
      })
      .catch(function(error) {
        reject(error);
      })
      .done(); 
  });
};

Project.prototype._getCachedSession = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (fs.existsSync(path.join(self.path, 'config', '.session'))) {
      fs.readJson(path.join(self.path, 'config', '.session'), function(err, cachedSession) {
        if (err) {
          if (err.message.indexOf('Unexpected end of input') >= 0) {
            resolve({});
          } else {
            reject(err);
          }
        } else {
          self.cachedSession = cachedSession;
          resolve(cachedSession);
        }
      });
    } else {
      resolve({});
    }
  });
};

Project.prototype.getSubscription = function() {
  return this.settings.subscription;
};

/**
 * Updates project subscriptions
 * @param {String} key - setting key you'd like to override
 * @param  {Array} newSubscription - array of types ['ApexClass', 'CustomObject']
 * @return {Promise}                 [description]
 */
Project.prototype.updateSetting = function(key, value) {
  var self = this;
  return new Promise(function(resolve, reject) {
    logger.debug('updating project setting ['+key+']');
    logger.debug(value);
    
    var settings;
    try {
      settings = fs.readJsonSync(path.join(self.path, 'config', '.settings'));  
    } catch(err) {
      reject(new Error('Could not read project .settings file: '+err.message));  
    }
    
    settings[key] = value;

    logger.debug('Updating project settings: ');
    logger.debug(settings);

    try {
      fs.writeFileSync(path.join(self.path, 'config', '.settings'), JSON.stringify(settings, null, 4));    
      self.settings = settings;
      resolve();
    } catch(err) {
      logger.error('Could not write project .settings file -->'+err.message);
      reject(err);
    }
  }); 
};

Project.prototype.updateCreds = function(creds) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.sfdcClient = new SalesforceClient({
      username: creds.username,
      password: creds.password,
      orgType: creds.orgType,
      loginUrl: creds.loginUrl
    }); 
    self.sfdcClient.initialize()
      .then(function() {
        return self._storePassword(creds.password);
      })
      .then(function() {
        return self.updateSetting('username', creds.username);
      })
      .then(function() {
        return self.updateSetting('environment', creds.orgType);
      })
      .then(function() {
        self.sfdcClient.on('sfdcclient-cache-refresh', function() {
          self._writeSession()
            .then(self._getCachedSession())
            .catch(function(err) {
              throw new Error('Could not update local session cache: '+err);
            })
            .done();
          return self._writeSession();
        });
        return self._writeSession();
      })
      .then(function() {
        return self._getCachedSession();
      })
      .then(function() {
        resolve();
      })
      .catch(function(err) {
        logger.error('Could not update credentials -->'+err.message);
        reject(err);
      })
      .done();
  }); 
};

// retrieves settings from config/.settings
Project.prototype._getSettings = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    fs.readJson(path.join(self.path, 'config', '.settings'), function(err, settings) {
      if (err) {
        reject(err);
      } else {
        self.settings = settings;
        self._getPassword()
          .then(function(pw) {
            self.settings.password = pw;
            resolve(self.settings);
          })
          .catch(function(err) {
            logger.error('Could not get project settings -->'+err.message);
            reject(err);
          })
          .done();
      }
    });
  });
};

// retrieves local_store from config/.local_store
Project.prototype.getLocalStore = function() {
  var localStore;
  try {
    localStore = fs.readJsonSync(path.join(this.path, 'config', '.local_store'));
  } catch(e) {
    if (e.message.indexOf('Unexpected end of input') >= 0) {
      localStore = {};
    } else {
      throw e;
    }  
  }
  return localStore;
};

Project.prototype.getDebugSettingsSync = function() {
  var debugSettings;
  try {
    debugSettings = fs.readJsonSync(path.join(this.path, 'config', '.debug'));
  } catch(e) {
    if (e.message.indexOf('Unexpected end of input') >= 0) {
      debugSettings = {};
    } else {
      throw e;
    }  
  }
  return debugSettings;  
};

Project.prototype.setLightningIndex = function(index) {
  var self = this;
  return new Promise(function(resolve, reject) {
    try {
      fs.outputFileSync(path.join(self.path, 'config', '.lightning'), JSON.stringify(index, null, 4));
      self.lightningIndex = index;
      resolve();
    } catch(err) {
      logger.error('Could not write lightning index file -->'+err.message);
      reject(err);
    }  
  }); 
};

Project.prototype.getLightningIndexSync = function() {
  var lightningIndex;
  try {
    lightningIndex = fs.readJsonSync(path.join(this.path, 'config', '.lightning'));
  } catch(e) {
    if (e.message.indexOf('Unexpected end of input') >= 0) {
      lightningIndex = [];
    } else {
      throw e;
    }  
  }
  return lightningIndex;  
};

Project.prototype.getLightningIndex = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    try {
      var lightningIndex = fs.readJsonSync(path.join(self.path, 'config', '.lightning'));
      return resolve(lightningIndex);
    } catch(err) {
      logger.debug('could not get index the first time');
      logger.debug(err);
      // if err is empty/missing file, index it
      self.indexLightning()
        .then(function() {
          logger.debug('done indexing lightning, now go get it');
          var lightningIndex = fs.readJsonSync(path.join(self.path, 'config', '.lightning'));
          return resolve(lightningIndex);
        })
        .catch(function(err) {
          logger.error('Could not get lightning index -->'+err.message);
          reject(err);
        });
    }
  });
};

// retrieves describe from config/.describe
Project.prototype.getDescribe = function() {
  return this._describe;
};

Project.prototype.setDescribe = function(describe) {
  var self = this;
  return new Promise(function(resolve, reject) {
    var describePath = path.join(self.path, 'config', '.describe');
    if (fs.existsSync(path.join(self.path, 'config'))) {
      fs.outputFile(describePath, JSON.stringify(describe, null, 4), function(err) {
        if (err) {
          return reject(err);  
        } else {
          self._describe = describe;
          resolve();
        }
      });
    } else {
      self._describe = describe;
      resolve();
    }
  });
};

// writes config/.settings
Project.prototype._refreshDescribeFromServer = function() {
  var self = this;  
  return new Promise(function(resolve, reject) {
    self.sfdcClient.describe()
      .then(function(res) {
        return self.setDescribe(res);
      })
      .then(function() {
        resolve();
      })
      .catch(function(error) {
        reject(error);
      })
      .done(); 
  });
};

Project.prototype.indexLightning = function() {
  var self = this;
  logger.debug('indexing lightning to config/.lightning');
  return new Promise(function(resolve, reject) {
    var lightningService = new LightningService(self);
    lightningService.getAll()
      .then(function(res) {
        return self.setLightningIndex(res); 
      })
      .then(function() {
        return resolve();
      })
      .catch(function(err) {
        if (err.message.indexOf('sObject type \'AuraDefinition\' is not supported') >= 0 || err.message.indexOf('requested resource does not exist') >= 0) {
          resolve();
        } else {
          logger.error('Could not index lightning -->'+err.message);
          reject(err);    
        }
      })
      .done();
  }); 
};

/**
 * Indexes Apex symbols
 * @return {Promise}
 */
Project.prototype.indexSymbols = function(apexClassName) {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (!fs.existsSync(path.join(self.path, 'config', '.symbols'))) {
      fs.mkdirpSync(path.join(self.path, 'config', '.symbols')); 
    }

    // todo: stash existing
    var symbolService = new SymbolService(self);

    var symbolPromise = apexClassName ? symbolService.indexApexClass(apexClassName) : symbolService.index();
    symbolPromise
      .then(function() {
        logger.debug('done indexing symbols!');
        resolve();
      })
      .catch(function(err) {
        logger.error('Could not index apex symbols: '+err.message);
        reject(err);
      })
      .done();
  }); 
};

/**
 * Populates project's config/.org_metadata with server metadata based on the projects subscription
 * @return {Promise}
 */
Project.prototype.indexMetadata = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    // todo: stash existing
    var indexService = new IndexService({ project: self });
    indexService.indexServerProperties(self.getSubscription())
      .then(function(res) {
        fs.outputFile(path.join(self.path, 'config', '.org_metadata'), JSON.stringify(res, null, 4), function(err) {
          if (err) {
            reject(err);  
          } else {
            resolve();
          }
        });
      })
      .catch(function(err) {
        logger.error('Could not index metadataHelper: '+err.message);
        reject(err);
      })
      .done();
  }); 
};

Project.prototype.getOrgMetadataIndex = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    fs.readJson(path.join(self.path, 'config', '.org_metadata'), function(err, orgMetadata) {
      if (err) {
        logger.debug('Could not return org metadata: '+err.message);
        resolve([]);
      } else {
        resolve(orgMetadata);
      }
    });
  });
};

Project.prototype.getOrgMetadataIndexWithSelections = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (fs.existsSync(path.join(self.path, 'config', '.org_metadata'))) {
      try {
        fs.readJson(path.join(self.path, 'config', '.org_metadata'), function(err, orgMetadata) {
          if (err) {
            reject(err);
          } else {          
            self.orgMetadata = orgMetadata;
            var indexService = new IndexService({ project: self });
            var metadataHelper = new MetadataHelper({ sfdcClient: self.sfdcClient });
            var ids = [];
            _.forOwn(self.packageXml.subscription, function(packageMembers, metadataTypeXmlName) {
              var metadataType = metadataHelper.getTypeByXmlName(metadataTypeXmlName); //inFolder, childXmlNames
              if (_.has(metadataType, 'parentXmlName')) {
                var parentMetadataType = metadataHelper.getTypeByXmlName(metadataType.parentXmlName);
              }
              if (packageMembers === '*') {
                ids.push(metadataTypeXmlName);
                var indexedType = _.find(orgMetadata, { 'xmlName': metadataTypeXmlName });
                if (_.has(indexedType, 'children')) {
                  _.each(indexedType.children, function(child) {
                    child.select = true;
                  });
                }
              } else {
                _.each(packageMembers, function(member) {
                  if (metadataType.inFolder) {
                    // id : Document.FolderName.FileName.txt
                    ids.push([metadataTypeXmlName, member.replace(/\//, '.')].join('.'));
                  } else if (parentMetadataType) {
                    // id : CustomObject.Object_Name__c.fields.Field_Name__c
                    var id = [ parentMetadataType.xmlName, member.split('.')[0], metadataType.tagName, member.split('.')[1] ].join('.');
                    ids.push(id);
                  } else if (_.has(metadataType, 'childXmlNames')) {
                    var indexedType = _.find(orgMetadata, { 'xmlName': metadataTypeXmlName });
                    var indexedNode = _.find(indexedType.children, { 'id': [metadataTypeXmlName, member].join('.')});
                    if (_.has(indexedNode, 'children')) {
                      _.each(indexedNode.children, function(child) {
                        child.select = true;
                        if (_.has(child, 'children')) {
                          _.each(child.children, function(grandChild) {
                            grandChild.select = true;
                          });
                        }
                      });
                    }
                    ids.push([metadataTypeXmlName, member].join('.'));
                  } else {
                    // id: ApexClass.MyClassName
                    ids.push([metadataTypeXmlName, member].join('.'));
                  }
                });
              }
            });
            indexService.setChecked(orgMetadata, ids);
            resolve(orgMetadata);
          }
        });
      } catch(err) {
        logger.debug('Could not getOrgMetadataIndexWithSelections: '+err.message);
        resolve([]);
      }
    } else {
      logger.debug('org_metadata not found, returning empty array');
      resolve([]);
    }
  });
};

Project.prototype.hasIndexedMetadata = function() {
  return _.isArray(this.orgMetadata) && this.orgMetadata.length > 0;
};

Project.prototype.updateLocalStore = function(fileProperties) {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (!self.metadataHelper) {
      self.metadataHelper = new MetadataHelper({ sfdcClient: self.sfdcClient });
    }

    Promise.resolve(fileProperties).then(function (properties) {
      if (!_.isArray(properties)) {
        properties = [properties];
      }
      try {
        var store = self.getLocalStore();
        _.each(properties, function(fp) {
          var metadataType;
          if (fp.type) {
            metadataType = self.metadataHelper.getTypeByXmlName(fp.type);
          } else {
            metadataType = self.metadataHelper.getTypeByPath(fp.fileName.split('.')[1]);
          }
          // console.log(metadataType);
          if (metadataType && fp.fullName.indexOf('package.xml') === -1) {
            var key = fp.fullName+'.'+metadataType.suffix;
            var value = fp;
            value.mmState = 'clean';
            store[key] = value;
          } else {
            if (fp.fullName.indexOf('package.xml') === -1) {
              logger.debug('Could not determine metadata type for: '+JSON.stringify(fp));
            }
          }
        });

        var filePath = path.join(self.path, 'config', '.local_store');
        fs.outputFile(filePath, JSON.stringify(store, null, 4), function(err) {
          if (err) {
            logger.error('Could not write local store: '+err.message);
            reject(err);  
          } else {
            resolve();
          }
        });
      } catch(err) {
        logger.error('Could not update local store -->'+err.message);
        reject(err);
      }  
    });
  });
};

Project.prototype._writeLocalStore = function(fileProperties) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.metadataHelper = new MetadataHelper({ sfdcClient: self.sfdcClient });
    Promise.resolve(fileProperties)
      .then(function (properties) {
        try {
          if (!_.isArray(properties)) {
            properties = [properties];
          }
          logger.debug('writing local store -->');
          logger.debug(properties);
          var store = {};
          _.each(properties, function(fp) {
            // logger.debug('fileProperty:');
            // logger.debug(fp);
            var metadataType = self.metadataHelper.getTypeByPath(fp.fileName);
            logger.debug(metadataType);
            if (metadataType !== undefined && fp.fullName.indexOf('package.xml') === -1) {
              var key = fp.fullName+'.'+metadataType.suffix;
              var value = fp;
              value.mmState = 'clean';
              store[key] = value;
            } else {
              if (fp.fullName.indexOf('package.xml') === -1) {
                logger.debug('Could not determine metadata type for: '+JSON.stringify(fp));
              }
            }
          });
          var filePath = path.join(self.path, 'config', '.local_store');
          fs.outputFile(filePath, JSON.stringify(store, null, 4), function(err) {
            if (err) {
              reject(new Error('Could not write local store: '+err.message));  
            } else {
              resolve();
            }
          });
        } catch(err) {
          logger.error('Could not initiate local store-->'+err.message);
          reject(err); 
        }
      });
  });
};

// write cached session
Project.prototype._writeSession = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    var filePath = path.join(self.path, 'config', '.session');
    
    var session = {
      accessToken: self.sfdcClient.getAccessToken(),
      instanceUrl: self.sfdcClient.conn.instanceUrl
    };

    logger.debug('writing local session');
    logger.debug(session);

    fs.outputFile(filePath, JSON.stringify(session, null, 4), function(err) {
      if (err) {
        reject(err);  
      } else {
        resolve();
      }
    });
  });
};

// writes config/.settings
Project.prototype._writeSettings = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    var settings = {
      projectName: self.name,
      username: self.sfdcClient.getUsername(),
      id: self.id,
      namespace: self.sfdcClient.getNamespace() || '',
      environment: self.sfdcClient.getOrgType(),
      workspace: self.workspace,
      subscription: self.subscription || config.get('mm_default_subscription')
    };
    if (!self.keychainService.useSystemKeychain()) {
      settings.password = self.password;
    }
    var filePath = path.join(self.path, 'config', '.settings');
    fs.outputFile(filePath, JSON.stringify(settings, null, 4), function(err) {
      if (err) {
        reject(err);  
      } else {
        resolve();
      }
    });
  });
};

// writes config/.debug
Project.prototype._writeDebug = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    var debug = {
      users: [self.sfdcClient.conn.userInfo.user_id],
      levels: {
          Workflow: 'INFO', 
          Callout: 'INFO', 
          System: 'DEBUG', 
          Database: 'INFO', 
          ApexCode: 'DEBUG', 
          Validation: 'INFO', 
          Visualforce: 'DEBUG'
      }, 
      expiration: 480
    };

    var filePath = path.join(self.path, 'config', '.debug');
    fs.outputFile(filePath, JSON.stringify(debug, null, 4), function(err) {
      if (err) {
        reject(err);  
      } else {
        resolve();
      }
    });
  });
};

Project.prototype._writeEditorSettings = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (process.env.MAVENSMATE_EDITOR === 'sublime') {
      /*jshint camelcase: false */
      var sublimeSettings = {
        folders : [
          {
            path : '.'
          }
        ],
        settings : {
          auto_complete_triggers : [
            {
                characters: '.', 
                selector: 'source'
            }, 
            {
                characters: ':', 
                selector: 'text.html'
            }, 
            {
                characters: '<',
                selector: 'text.html'
            }, 
            {
                characters: ' ', 
                selector: 'text.html'
            }
          ]
        }
      };
      /*jshint camelcase: true */
      var filePath = path.join( self.path, [ self.name, 'sublime-project' ].join('.') );
      fs.outputFile(filePath, JSON.stringify(sublimeSettings, null, 4), function(err) {
        if (err) {
          reject(err);  
        } else {
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
};

Project.prototype._storePassword = function(pw) {
  var self = this;
  return new Promise(function(resolve, reject) {
    try {
      if (self.settings && self.settings.password && pw) {
        self.updateSetting('password', pw)
          .then(function() {
            resolve();       
          })
          .catch(function(err) {
            logger.error('Could not update password setting -->'+err.message);
            reject(err);
          })
          .done(); 
      } else {
        if (self.keychainService.useSystemKeychain()) {
          self.keychainService.storePassword(self.id, pw || self.password);
          resolve();
        } else {
          self.updateSetting('password', pw || self.password)
            .then(function() {
              resolve();       
            })
            .catch(function(err) {
              logger.error('Could not update password setting -->'+err.message);
              reject(err);
            })
            .done(); 
        }
      }
    } catch(err) {
      logger.error('Could not store password -->'+err.message);
      reject(err);
    }
  });
};

Project.prototype._getPassword = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    try {
      // if the password is specified in config/.settings, it overrides their desire/ability to use keychain
      if (self.settings.password) {
        resolve(self.settings.password);
      } else {
        var pw;
        if (self.keychainService.useSystemKeychain()) {
          pw = self.keychainService.getPassword(self.settings.id);
          if (!pw) {
            reject(new Error('Could not retrieve password from the system keychain. If you do not wish to use the system keychain, set "mm_use_keyring" to false, then specify the org password in your project\'s config/.settings file.'));
          } else {
            resolve(pw);
          }
        } else {
          reject(new Error('No "password" property in project config/.settings file.'));
        }
      }
    } catch(err) {
      logger.error('Could not retrieve password -->'+err.message);
      reject(err);
    }
  });
};

module.exports = Project;
