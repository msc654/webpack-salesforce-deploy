'use strict';

var jsforce       = require('jsforce');
var Promise       = require('bluebird');
var fs            = require('fs');
var _             = require('lodash');
var merge         = require('merge');
var util          = require('./util').instance;
var randomstring  = require('randomstring');
var events        = require('events');
var inherits      = require('inherits');
var stream        = require('stream');
var Stream        = stream.Stream;
var logger        = require('winston');
var config        = require('./config');

/**
 * Represents connection to salesforce, many functions wrap jsforce
 * @param {Object} opts
 * @param {String} [opts.accessToken] - salesforce.com accesstoken
 * @param {String} [opts.username] - (optional) salesforce.com username
 * @param {String} [opts.password] - (optional) salesforce.com password
 * @param {String} [opts.securityToken] - (optional) salesforce.com security token
 * @param {String} [opts.orgType] - (optional) type of org: developer|production|sandbox|prerelease
 * @param {String} [opts.loginUrl] - Salesforce Login Server URL (e.g. https://login.salesforce.com/)
 * @param {String} [opts.instanceUrl] - Salesforce Instance URL (e.g. https://na1.salesforce.com/)
 * @param {String} [opts.serverUrl] - Salesforce SOAP service endpoint URL (e.g. https://na1.salesforce.com/services/Soap/u/28.0)
 * @param {String} [opts.logger] - Logger instance
 *
 */
function SalesforceClient(opts) {
  util.applyProperties(this, opts);
  this.apiVersion = config.get('mm_api_version');
  logger.debug('initiating SalesforceClient: ');
}

inherits(SalesforceClient, events.EventEmitter);

SalesforceClient.prototype._initRefreshHandler = function() {
  var self = this;
  self.conn.on('refresh', function() {
    self.emit('sfdcclient-cache-refresh', self); 
  });
};

/**
 * Attempts to use cached session information to initiate connection to salesforce
 * Alternatively, will perform login based on stored creds
 */
SalesforceClient.prototype.initialize = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    logger.debug('initializing connection to salesforce ...');
    // optionally support the ability to pass in an access token
    var accessToken = self.getAccessToken();
    if (accessToken) {
      logger.debug('attempting to use cached session information ...');

      self.conn = new jsforce.Connection({ sessionId: accessToken, instanceUrl: self.getInstanceUrl(), logLevel: 'FATAL', version: self.apiVersion });
      self._initRefreshHandler();
      self.conn.identity(function(err, res) {
        if (err) {
          logger.debug('bad access token, resetting and performing login');
          
          self.accessToken = undefined;
          self.conn.accessToken = undefined;
    
          self._login()
            .then(function() {
              self._configureJsForce();
              return self.describe();
            })
            .then(function() {
              self.emit('sfdcclient-cache-refresh', self);
              resolve();
            })
            .catch(function(error) {
              reject(new Error('Could not log in to Salesforce.com: '+error));
            })
            .done();
        } else {
          self.conn.userInfo = merge(self.conn.userInfo, res);
          self._configureJsForce();
          self.describe()
            .then(function() {
              resolve(self.conn);
            })
            .catch(function(error) {
              reject(new Error('Could initiate salesforce client: '+error));
            })
            .done();
        }
      });
    } else {
      logger.debug('initing connection via login ...');

      self._login()
        .then(function() {
          self._configureJsForce();
          return self.describe();
        })
        .then(function() {
          resolve();
        })
        .catch(function(error) {
          reject(new Error('Could not log in to Salesforce.com: '+error));
        })
        .done();
    }
  });
};

/**
 * Returns the org type (developer, production, sandbox, prerelease, custom) for this client
 * @return {String}
 */
SalesforceClient.prototype.getOrgType = function() {
  var validOrgTypes = ['production', 'developer', 'sandbox', 'prerelease'];
  if (this.orgType && validOrgTypes.indexOf(this.orgType.toLowerCase()) === -1) {
    return validOrgTypes[1];
  } else if (!this.orgType) {
    return validOrgTypes[1];
  } else {
    return this.orgType.toLowerCase();
  }
};

SalesforceClient.prototype.getUserId = function() {
  if (this.conn && this.conn.userInfo) {
    return this.conn.userInfo.user_id;
  }
};

/**
 * Returns username for this client
 * @return {String}
 */
SalesforceClient.prototype.getUsername = function() {
  if (this.conn && this.conn.userInfo) {
    return this.conn.userInfo.username;
  } else {
    return this.username;
  }
};

/**
 * Returns password for this client
 * @return {String}
 */
SalesforceClient.prototype.getPassword = function() {
  return this.password;
};

/**
 * Returns org namespace for this client
 * @return {String}
 */
SalesforceClient.prototype.getNamespace = function() {
  return this.describeCache.organizationNamespace;
};

/**
 * Returns login url for this client
 * @return {String}
 */
SalesforceClient.prototype._getLoginUrl = function() {
  if (this.loginUrl) {
    return this.loginUrl;
  } else {
    if (this.getOrgType() === 'sandbox') {
      return 'https://test.salesforce.com/';
    } else {
      return 'https://login.salesforce.com/';
    }
  }
};

/**
 * Returns access token for this client
 * @return {String}
 */
SalesforceClient.prototype.getAccessToken = function() {
  if (this.conn && this.conn.accessToken) {
    return this.conn.accessToken;  
  } else if (this.accessToken) {
    return this.accessToken;
  } else {
    return undefined;
  }
};

/**
 * Returns instance url (e.g., https://na14.salesforce.com) for this client
 * @return {String}
 */
SalesforceClient.prototype.getInstanceUrl = function() {
  return this.instanceUrl || this.conn.instanceUrl || undefined;
};

/**
 * logs into salesforce, retrieves session id (access token)
 */
SalesforceClient.prototype._login = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    logger.debug('logging in to salesforce: '+self._getLoginUrl());
    self.conn = new jsforce.Connection({ logLevel: 'FATAL', version: self.apiVersion, loginUrl: self._getLoginUrl() });
    self._initRefreshHandler();
    self.conn.login(self.username, self.password, function(err) {
      if (err) { 
        logger.debug('error logging in: '+err.message);
        reject(err);
      } else {
        logger.debug('getting user information:');
        self.conn.identity(function(err, res) {
          if (err) {
            reject(err);
          } else {
            self.conn.userInfo = merge(self.conn.userInfo, res);
            logger.debug('logged in successfully');
            // logger.debug(self.conn);
            self.accessToken = self.conn.accessToken;
            resolve(self.conn);
          }
        });
      }
    });
  });
};

/**
 * Applies MavensMate-specific settings to jsforce
 * @return {String}
 */
SalesforceClient.prototype._configureJsForce = function() {
  logger.debug('configuring jsforce ...');
  this.conn.metadata.pollTimeout = parseInt(config.get('mm_timeout')) * 1000 || 20000;
};

SalesforceClient.prototype.setPollingTimeout = function(timeout) {
  this.conn.metadata.pollTimeout = timeout || 20000;
};

/**
 * Compiles files via Tooling API
 * @param  {Array of Metadata} metadata - metadata to be compiled (must already exist in salesforce)
 * @return {Promise}
 */
SalesforceClient.prototype.compileWithToolingApi = function(files) {
  var self = this;
  return new Promise(function(resolve, reject) {
    // logger.debug('compiling sfdcPaths via tooling api: '+JSON.stringify(sfdcPaths));

    if ( _.filter( files, function(f) { return !f.isToolingType; } ).length > 0 ) {
      return reject('Invalid extension for tooling API compilation');
    }

    // new container
    // add member for each type
    var containerId;

    self._createContainer()
      .then(function(result) {
        containerId = result.id;
        logger.debug('new container id is: '+containerId);
        var memberPromises = [];
        _.each(files, function(f) {
          memberPromises.push(self._createMember(f, containerId));
        });
        return Promise.all(memberPromises);
      })
      .then(function(memberResults) {
        var isMemberSuccess = _.where(memberResults, { 'success': false }).length === 0;

        if (!isMemberSuccess) {
          return reject('Could not create tooling members: '+JSON.stringify(memberResults));
        }

        return self._createContainerAsyncRequest(containerId);
      })
      .then(function(result) {
        self._pollAsyncContainer(containerId, result.id, resolve, reject);
      })
      .catch(function(error) {
        reject(error);
      })
      .done();
  });
};

SalesforceClient.prototype._asyncContainerRequestCompleteHandler = function(containerId, results, resolve, reject) {
  logger.debug('asyncContainerRequestCompleteHandler');
  logger.debug('deleting container id:');
  logger.debug(containerId);
  logger.silly(results);
  try {
    this._deleteContainer(containerId)
      .then(function() {
        resolve(results);
      });
  } catch(e) {
    reject(e);
  }
};

SalesforceClient.prototype._asyncContainerRequestErrorHandler = function(containerId, err, resolve, reject) {
  logger.debug('asyncContainerRequestErrorHandler');
  logger.debug('deleting container id:');
  logger.debug(containerId);
  try {
    this._deleteContainer(containerId)
      .then(function() {
        reject(err);
      });
  } catch(e) {
    reject(e);
  }
};

/**
 * Deletes a metadata container
 *
 * @method SalesforceClient#_deleteContainer
 * @param {String} containerId - Id of metadatacontainer
 */
SalesforceClient.prototype._deleteContainer = function(containerId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.conn.tooling.sobject('MetadataContainer').delete(containerId, function(err, res) {
      if (err) { 
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
};

/**
 * Submits container to create containerasyncrequest
 *
 * @method SalesforceClient#_createContainerAsyncRequest
 * @param {String} containerId - Id of metadatacontainer
 */
SalesforceClient.prototype._createContainerAsyncRequest = function(containerId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.conn.tooling.sobject('ContainerAsyncRequest').create({
      IsCheckOnly: false,
      MetadataContainerId: containerId,
      IsRunTests:false
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
 * Polling until asynccontainer is complete or error
 *
 * @method SalesforceClient#_pollAsyncContainer
 * @param {Number} interval - Polling interval in milliseconds
 * @param {Number} timeout - Polling timeout in milliseconds
 */
SalesforceClient.prototype._pollAsyncContainer = function(containerId, requestId, resolve, reject, interval, timeout) {
  logger.debug('_pollAsyncContainer for requestId: '+requestId);
  var self = this;
  var startTime = new Date().getTime();
  var poll = function() {
    var now = new Date().getTime();
    if (startTime + timeout < now) {
      self.emit('error', new Error('polling time out'));
      return;
    }
    self._getAsyncRequest(requestId).then(function(results) {
      var done = results[0].State !== 'Queued';
      if (done) {
        // self.emit('asynccontainer-complete', results);
        self._asyncContainerRequestCompleteHandler(containerId, results, resolve, reject);
      } else {
        setTimeout(poll, interval);
      }
    }, function(err) {
      // self.emit('asynccontainer-error', err);
      self._asyncContainerRequestErrorHandler(containerId, err, resolve, reject);
    });
  };
  setTimeout(poll, interval);
};

/**
 * Retrieves async request details
 * @return {Promise}
 */
SalesforceClient.prototype._getAsyncRequest = function(requestId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    var fields;
    if (parseInt(self.apiVersion) >= 31) {
      fields = ['Id', 'MetadataContainerId', 'MetadataContainerMemberId', 'State', 'IsCheckOnly', 'DeployDetails', 'ErrorMsg'];
    } else {
      fields = ['Id', 'MetadataContainerId', 'MetadataContainerMemberId', 'State', 'IsCheckOnly', 'CompilerErrors', 'ErrorMsg'];
    }

    self.conn.tooling.sobject('ContainerAsyncRequest')
      .find(
        { Id: requestId }, 
        fields
      )
      .execute(function(err, records) {
        if (err) {
          reject(err);
        } else {
          resolve(records);
        }
      });
  }); 
};

/**
 * Creates a metadata container for compilation
 * @return {Promise}
 */
SalesforceClient.prototype._createContainer = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.conn.tooling.sobject('MetadataContainer').create({
      name: randomstring.generate(32)
    }, function(err, res) {
      if (err) {
        reject('Could not create container: '+JSON.stringify(res));
      } else {
        resolve(res);
      }
    }); 
  }); 
};

/**
 * Creates a Tooling member for each metadata instance passed
 * @param  {Metadata} metadata - Instance of Metadata
 * @param  {String} containerId - Tooling container ID
 * @return {Promise}
 */
SalesforceClient.prototype._createMember = function(file, containerId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    var memberName = file.type.xmlName+'Member';
    logger.debug('Creating tooling member:');
    logger.silly(file.body);
    logger.debug(containerId);
    logger.debug(file.id);
    self.conn.tooling.sobject(memberName).create({
      Body: file.body,
      MetadataContainerId: containerId,
      ContentEntityId: file.id
    }, function(err, res) {
      if (err) { 
        reject(err);
      } else {
        resolve(res);
      }
    }); 
  }); 
};

SalesforceClient.prototype._checkTest = function(jobId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.conn.tooling.query('Select ApexClassId, ApexClass.Name, Status, ExtendedStatus From ApexTestQueueItem Where ParentJobId = \''+jobId+'\' AND Status IN (\'Aborted\',\'Completed\',\'Failed\')', function(err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });  
};

SalesforceClient.prototype._getTestResults = function(jobId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.conn.tooling.query('SELECT Outcome, ApexClassId, ApexClass.Name, MethodName, Message, StackTrace, ApexLogId FROM ApexTestResult WHERE AsyncApexJobId = \''+jobId+'\'', function(err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
}; 

/**
 * Runs selected apex unit tests
 * @param  {Array} tests - e.g, [{ "ApexClassId" : "1234" }]
 * @return {Promise} Resolves to Object
 */
SalesforceClient.prototype.runTests = function(tests) {
  var self = this;
  return new Promise(function(resolve, reject) {
    var numberOfTests = tests.length;
    var pollInterval = numberOfTests > 10 ? 5000 : 1000;
    
    // we use the bulk api here so that our tests share a single job id  
    self.conn.bulk.load('ApexTestQueueItem', 'insert', tests, function(err, res) {
      if (err) { 
        reject(err);
      } else {
        // now we need to get the parentjob id that's shared by all our tests
        var testQueueItemId = res[0].id;
        self.conn.tooling.query('Select ParentJobId FROM ApexTestQueueItem WHERE Id = \''+testQueueItemId+'\'', function(err, res) {
          if (err) { 
            reject(err);
          } else {
            logger.debug(res);
            var parentJobId = res.records[0].ParentJobId;
            
            // poll for the test results
            var startTime = new Date().getTime();
            var poll = function() {
              var now = new Date().getTime();
              if (startTime + self.conn.metadata.pollTimeout < now) {
                reject(new Error('Apex test request timed out. Timeout can be configured via mm_timeout setting.'));
                return;
              }
              self._checkTest(parentJobId).then(function(classResults) {
                logger.debug('test status: ');
                logger.debug(classResults);
                if (classResults.size === numberOfTests) {
                  self._getTestResults(parentJobId)
                    .then(function(result) {
                      resolve({classResults: classResults, methodResults: result});
                    })
                    .catch(function(err) {
                      reject(new Error('Retrieving test results failed: '+err.message));
                    })
                    .done();
                } else {
                  setTimeout(poll, pollInterval);  
                }
              })
              .catch(function(err) {
                reject(new Error('Retrieving test results failed: '+err.message));
              })
              .done();
            };
            setTimeout(poll, pollInterval);
          }
        });
      }
    }); 
  });  
};

/**
 * Executes anonymous Apex
 * @return {Promise}
 */
SalesforceClient.prototype.executeApex = function(payload) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.conn.tooling.executeAnonymous(payload.body, function(err, res) {
      if (err) {
        reject('Could not execute anonymous apex: '+err.message);
      } else {
        resolve(res);
      }
    }); 
  });   
};

/**
 * Deploy components into an organization using zipped file representations
 *
 * @param {stream.Stream|Buffer} zipInput - Zipped file input source in readable stream or binary buffer
 * @param {Object} [options] - Options used in deployment
 * @param {Boolean} [options.allowMissingFiles] - Specifies whether a deploy succeeds even if files that are specified in package.xml but are not in the .zip file or not.
 * @param {Boolean} [options.autoUpdatePackage] - If a file is in the .zip file but not specified in package.xml, specifies whether the file should be automatically added to the package or not.
 * @param {Boolean} [options.checkOnly] - Indicates whether Apex classes and triggers are saved to the organization as part of the deployment (false) or not (true).
 * @param {Boolean} [options.ignoreWarnings] - Indicates whether a warning should allow a deployment to complete successfully (true) or not (false). Defaults to false.
 * @param {Boolean} [options.performRetrieve] - Indicates whether a retrieve() call is performed immediately after the deployment (true) or not (false).
 * @param {Boolean} [options.purgeOnDelete] - If true, the deleted components in the destructiveChanges.xml manifest file aren't stored in the Recycle Bin.
 * @param {Boolean} [options.rollbackOnError] - Indicates whether any failure causes a complete rollback (true) or not (false).
 * @param {Boolean} [options.runAllTests] - If true, all Apex tests defined in the organization are run.
 * @param {Array.<String>} [options.runTests] - A list of Apex tests to be run during deployment.
 * @param {Boolean} [options.singlePackage] - Indicates whether the specified .zip file points to a directory structure with a single package (true) or a set of packages (false).
 * @param {Callback.<Metadata~AsyncResult>} [callback] - Callback function
 * @returns {Metadata~DeployResultLocator}
 */
SalesforceClient.prototype.deploy = function(zipInput, opts) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.conn.metadata.deploy(zipInput, opts)
      .complete(true, function(err, result) {
          if (err) { 
            reject(err);
          } else {
            resolve(result);
          }
        });
  });
};

/**
 * Retrieve packaged medadata --> TODO: finish
 * @param  {Array} packageNames - list of packages
 * @return {Promise}
 */
SalesforceClient.prototype.retrievePackages = function(packageNames) {
  var self = this;
  return new Promise(function(resolve, reject) {
    var r = self.conn.metadata.retrieve({ packageNames: packageNames, apiVersion: self.apiVersion })
      .stream()
      .pipe(fs.createWriteStream('mavensmate.zip'));

    r.on('close', function() {
      logger.debug('ended!');
      resolve();
    });
  });
};

/**
 * Retrieves metadata from salesforce
 * @param  {Array|Object} metadataTypesOrPackage
 * @return {Promise} resolves with readable {Stream}
 */
SalesforceClient.prototype.retrieveUnpackaged = function(metadataTypesOrPackage) {
  var self = this;
  return new Promise(function(resolve, reject) {
    var unpackagedTypes = [];
    
    logger.debug('retrieving unpackaged: ');
    logger.debug(metadataTypesOrPackage);

    // TODO: refactor package generation
    if (_.isArray(metadataTypesOrPackage)) {
      _.each(metadataTypesOrPackage, function(type) {
        unpackagedTypes.push({
          members: '*',
          name: type
        });
      });
    } else {
      _.forOwn(metadataTypesOrPackage, function(value, key) {
        unpackagedTypes.push({
          members: value,
          name: key
        });
      });  
    }

    var retrieveRequest = self.conn.metadata.retrieve({ 
        unpackaged: { types : unpackagedTypes }, 
        apiVersion: self.apiVersion 
      });

    var zipStream = new Stream();
    zipStream.readable = true;
    
    var filePropertiesPromise = new Promise(function(resolve, reject) {
      retrieveRequest.complete(function(err, result) {
        if (err) {
          zipStream.emit('error', err);
          reject(new Error('Could not get fileProperties from retrieve result: '+err.message));
        } else {
          zipStream.emit('data', new Buffer(result.zipFile, 'base64'));
          zipStream.emit('end');
          resolve(result.fileProperties);
        }
      });
    });

    // returns a stream for the zip file and a promise to return file properties
    resolve({ zipStream: zipStream, fileProperties: filePropertiesPromise });
  });
};

SalesforceClient.prototype.describeGlobal = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.conn.describeGlobal(function(err, res) {
      if (err) {
        reject(err);
      } else {
        resolve(res);       
      }
    });
  });
};

SalesforceClient.prototype.describe = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.conn.metadata.describe(self.apiVersion, function(err, res) {
      if (err) {
        reject(err);
      } else {
        self.describeCache = res;
        resolve(res);       
      }
    });
  });
};

SalesforceClient.prototype.listFolder = function(metadataType, folder) { 
  var self = this;
  return new Promise(function(resolve, reject) {
    var result = {};
    self.conn.metadata.list([{ type: metadataType, folder: folder }], function(err, res) {
      if (err) {
        reject(err);
      } else {
        if (!res) {
          res = [];
        } else if (!_.isArray(res)) {
          res = [res];
        }
        result[folder] = res;
        resolve(result);       
      }
    });
  });
};

SalesforceClient.prototype.list = function(metadataType) { 
  var self = this;
  return new Promise(function(resolve, reject) {
    var result = {};
    self.conn.metadata.list([{ type: metadataType }], function(err, res) {
      if (err) {
        reject(err);
      } else {
        if (!res) {
          res = [];
        } else if (!_.isArray(res)) {
          res = [res];
        }
        result[metadataType] = res;
        resolve(result);       
      }
    });
  });
};

SalesforceClient.prototype.startSystemStreamingListener = function() { 
  var self = this;
  return new Promise(function(resolve, reject) {
    logger.debug('starting system streaming listener');
    try {
      self.conn.streaming.systemTopic('Logging').subscribe(function(message) {
        logger.debug('Event Type : ' + message.event.type);
        logger.debug('Event Created : ' + message.event.createdDate);
        logger.debug('Object Id : ' + message.sobject.Id);
        self.emit('sfdcclient-new-log', message);
      });
      resolve();
    } catch(e) {
      reject(new Error('Could not start system streaming listener: '+e.message));
    }
  });
};

/**
 * Creates TraceFlags for all user ids listed in config/.debug
 * @param  {Array} userIds
 * @param  {Date} expiration
 * @return {Promise} resolves to nothing
 */
SalesforceClient.prototype.startLogging = function(userIds, expiration) {
  var self = this;
  logger.debug('attempting to start logging for: ');
  logger.debug(userIds);
  logger.debug('expiring: '+expiration);
  return new Promise(function(resolve, reject) {
    /*jshint camelcase: false */
    self.conn.tooling.query('SELECT Id FROM TraceFlag WHERE TracedEntityId IN ('+util.joinForQuery(userIds)+') AND CreatedById = \''+self.conn.userInfo.user_id+'\'', function(err, res) {
      if (err) {
        reject(new Error('Could not retrieve TraceFlags for debug users: '+err.message));
      } else {
        var traceFlagIdsToDelete = [];

        _.each(res.records, function(traceFlag) {
          traceFlagIdsToDelete.push(traceFlag.Id);
        });
        logger.debug('attempting to delete trace flags: ');
        logger.debug(traceFlagIdsToDelete);
        self.conn.tooling.sobject('TraceFlag').destroy(traceFlagIdsToDelete)
          .then(function(deleteResult) {
            logger.debug('deleted trace flags');
            logger.debug(deleteResult);
            var traceFlagsToCreate = [];
            _.each(userIds, function(userId) {
              var tf = {
                ExpirationDate: expiration,
                TracedEntityId: userId,
              };
              traceFlagsToCreate.push(tf);
            });
            logger.debug('attempting to create trace flags');
            return self.conn.tooling.sobject('TraceFlag').create(traceFlagsToCreate);        
          })
          .then(function(traceFlagCreateResults) {
            logger.debug('Created trace flag(s) for users: ');
            logger.debug(traceFlagCreateResults);
            resolve();
          })
          .catch(function(err) {
            reject(new Error('Could not create Trace Flags: '+err.message));
          })
          .done(); 
      }   
    });
    /*jshint camelcase: true */
  });  
};

/**
 * Deletes TraceFlags created by the running user for the supplied userIds
 * @param  {Array of Strings} userIds
 * @return {Promise} resolves to nothing
 */
SalesforceClient.prototype.stopLogging = function(userIds) {
  var self = this;
  return new Promise(function(resolve, reject) {
    /*jshint camelcase: false */
    self.conn.tooling.query('SELECT Id FROM TraceFlag WHERE TracedEntityId IN ('+util.joinForQuery(userIds)+') AND CreatedById = \''+self.conn.userInfo.user_id+'\'', function(err, res) {
      if (err) {
        reject(new Error('Could not retrieve TraceFlags for debug users: '+err.message));
      } else {
        var traceFlagIdsToDelete = [];

        _.each(res.records, function(traceFlag) {
          traceFlagIdsToDelete.push(traceFlag.Id);
        });
        
        self.conn.tooling.sobject('TraceFlag').destroy(traceFlagIdsToDelete)
          .then(function(deleteResult) {
            logger.debug('deleted trace flags');
            logger.debug(deleteResult);
            resolve();
          })
          .catch(function(err) {
            reject(new Error('Could not delete Trace Flags: '+err.message));
          })
          .done(); 
      }   
    });
    /*jshint camelcase: true */
  });  
};

module.exports = SalesforceClient;
