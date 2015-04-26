'use strict';

var Promise         = require('bluebird');
var _               = require('lodash');
var fs              = require('fs-extra');
var path            = require('path');
var MetadataHelper  = require('./metadata').MetadataHelper;
var util            = require('./util').instance;
var config          = require('./config');
var request         = require('request');
var swig            = require('swig');
var logger          = require('winston');

var types = {
    TOP_LEVEL_METADATA_DIRECTORY: 'TOP_LEVEL_METADATA_DIRECTORY',
    TOP_LEVEL_METADATA_FILE: 'TOP_LEVEL_METADATA_FILE',
    METADATA_FOLDER: 'METADATA_FOLDER',
    METADATA_FOLDER_ITEM: 'METADATA_FOLDER_ITEM',
    LIGHTNING_BUNDLE: 'LIGHTNING_BUNDLE',
    LIGHTNING_BUNDLE_ITEM: 'LIGHTNING_BUNDLE_ITEM'
};
Object.freeze(types);

var lightningTypes = {
    STYLE: 'STYLE',
    APPLICATION: 'APPLICATION',
    DOCUMENTATION: 'DOCUMENTATION',
    COMPONENT: 'COMPONENT',
    EVENT: 'EVENT',
    INTERFACE: 'INTERFACE',
    CONTROLLER: 'CONTROLLER',
    HELPER: 'HELPER',
    RENDERER: 'RENDERER'
};
Object.freeze(lightningTypes);

var MavensMateFile = function(opts) {
  opts = opts || {};
  this.path = opts.path;
  this.project = opts.project;
  this.metadataHelper = this.project ? new MetadataHelper({ sfdcClient : this.project.sfdcClient }) : new MetadataHelper();
  if (this.path) {
    this.type = this.metadataHelper.getTypeByPath(this.path);   
    this.basename = path.basename(this.path);
    this.name = this.basename.split('.')[0];
    this.folderName = path.basename(path.dirname(this.path));
    this.extension = path.extname(this.path).replace(/./, '');
  }
};

MavensMateFile.prototype._template = null;
MavensMateFile.prototype._basename = null;
MavensMateFile.prototype._name = null;
MavensMateFile.prototype._folderName = null;
MavensMateFile.prototype._extension = null;

/**
 * whether the path represents a directory
 */
Object.defineProperty(MavensMateFile.prototype, 'isDirectory', {
  get: function() {
    if (this.type.xmlName === 'Document') {
      return path.extname(this.path) === ''; //TODO: some documents may not have an extension!
    } else {
      return path.extname(this.path) === '';      
    }
  }
});

/**
 * basename of path
 */
Object.defineProperty(MavensMateFile.prototype, 'basename', {
  get: function() {
    return this._basename;
  },
  set: function(value) {
    this._basename = value;
  }
});

/**
 * basename of path without extension
 */
Object.defineProperty(MavensMateFile.prototype, 'name', {
  get: function() {
    return this._name;
  },
  set: function(value) {
    this._name = value;
  }
});

/**
 * basename of path without extension
 */
Object.defineProperty(MavensMateFile.prototype, 'folderName', {
  get: function() {
    return this._folderName;
  },
  set: function(value) {
    this._folderName = value;
  }
});

/**
 * basename of path without extension
 */
Object.defineProperty(MavensMateFile.prototype, 'extension', {
  get: function() {
    return this._extension;
  },
  set: function(value) {
    this._extension = value;
  }
});

/**
 * name when referenced via package.xml
 */
Object.defineProperty(MavensMateFile.prototype, 'packageName', {
  get: function() {
    if (this.classification === types.METADATA_FOLDER_ITEM) {
      return this.folderName + '/' + this.name;
    } else {
      return this.name;
    }
  }
});

Object.defineProperty(MavensMateFile.prototype, 'isToolingType', {
  get: function() {
    var supportedExtensions = ['cls', 'trigger', 'page', 'component'];
    return supportedExtensions.indexOf(this.extension) >= 0;
  }
});

Object.defineProperty(MavensMateFile.prototype, 'isLightningType', {
  get: function() {
    return this.type.xmlName === 'AuraDefinitionBundle';
  }
});

/**
 * Returns base name of lightning component (e.g. fooRenderer -> foo)
 * @return {String}
 */
Object.defineProperty(MavensMateFile.prototype, 'lightningBaseName', {
  get: function() {
    var lbn = this.name;
    if (util.endsWith(lbn, 'Controller')) {
      lbn = lbn.replace(/Controller/, '');
    } else if (util.endsWith(lbn, 'Helper')) {
      lbn = lbn.replace(/Helper/, '');
    } if (util.endsWith(lbn, 'Renderer')) {
      lbn = lbn.replace(/Renderer/, '');
    }
    return lbn;
  },
});

Object.defineProperty(MavensMateFile.prototype, 'lightningType', {
  get: function() {
    if (this.extension === 'css') {
      return 'STYLE';
    } else if (this.extension === 'app') {
      return 'APPLICATION';
    } else if (this.extension === 'auradoc') {
      return 'DOCUMENTATION';
    } else if (this.extension === 'cmp') {
      return 'COMPONENT';
    } else if (this.extension === 'evt') {
      return 'EVENT';
    } else if (this.extension === 'intf') {
      return 'INTERFACE';
    } else if (this.extension === 'js') {
      if (util.endsWith(this.name, 'Controller')) {
        return 'CONTROLLER';
      } else if (util.endsWith(this.name, 'Helper')) {
        return 'HELPER';
      }  else if (util.endsWith(this.name, 'Renderer')) {
        return 'RENDERER';
      }
    } 
  }
});

/**
 * classification of the path
 */
Object.defineProperty(MavensMateFile.prototype, 'classification', {
  get: function() {
    if (this.type.inFolder) {
      var inFolderTypeDirectoryNames = this.metadataHelper.inFolderDirectoryNames;
      if (this.isDirectory) {
        if (inFolderTypeDirectoryNames.indexOf(path.basename(path.dirname(this.path))) >= 0) {
          return types.TOP_LEVEL_METADATA_DIRECTORY;
        } else {
          return types.METADATA_FOLDER;
        }
      } else {
        return types.METADATA_FOLDER_ITEM;
      }
    } else if (this.type.xmlName === 'AuraDefinitionBundle') {
      if (this.isDirectory) {
        return types.LIGHTNING_BUNDLE;
      } else {
        return types.LIGHTNING_BUNDLE_ITEM;
      }
    } else {
      if (this.isDirectory) {
        return types.TOP_LEVEL_METADATA_DIRECTORY;
      } else {
        return types.TOP_LEVEL_METADATA_FILE;
      }
    }
  }
});

/**
 * Local file body (source code, conents, etc.)
 */
Object.defineProperty(MavensMateFile.prototype, 'body', {
  get: function() {
    if (this.isDirectory) {
      throw new Error('Can not get body of directory');
    }
    return util.getFileBody(this.path);
  }
});

/**
 * Returns whether this path type requires a corresponding meta file
 * @return {String}
 */
Object.defineProperty(MavensMateFile.prototype, 'hasMetaFile', {
  get: function() {
    return this.type.metaFile === true;
  }
});

/**
* Whether the instance exists on the disk (or virtual disk (future))
* @return {Boolean}
*/
Object.defineProperty(MavensMateFile.prototype, 'existsOnFileSystem', {
  get: function() {
    return this.path ? fs.existsSync(this.path) : false;
  }
});

/**
 * Whether this is a -meta.xml file
 * @return {Boolean}
 */
Object.defineProperty(MavensMateFile.prototype, 'isMetaFile', {
  get: function() {  
    return util.endsWith(this.path, '-meta.xml');
  }
});

/**
 * Id of the file on the server
 */
Object.defineProperty(MavensMateFile.prototype, 'id', {
  get: function() {
    try {  
      if (this.isDirectory) {
        throw new Error('Cannot get server id for directory.');
      } else {
        // determine id (useful for lightning/apex/vf types bc tooling api is preferential to ids)
        if (this.isLightningType && this.project) {
          var lightningIndex = this.project.getLightningIndexSync();
          return _.find(lightningIndex, { AuraDefinitionBundle : { DeveloperName: this.lightningBaseName }, DefType: this.lightningType }).Id;
        } else if (this.project) {
          return this.project.getLocalStore()[this.basename].id;
        }
      }
    } catch(e){
      logger.debug('Could not determine metadata id: '+e.message);
    }
  }
});

Object.defineProperty(MavensMateFile.prototype, 'localStoreEntry', {
  get: function() {
    try {  
      if (this.isDirectory || this.isLightningType) {
        throw new Error('Cannot get local store entry for directories or lightning types currently.');
      } else {
        return this.project.getLocalStore()[this.basename];
      }
    } catch(e){
      logger.debug('Could not determine local store entry: '+e.message);
    }
  }
});

Object.defineProperty(MavensMateFile.prototype, 'serverCopy', {
  get: function() {
    var self = this;
    return new Promise(function(resolve, reject) {
      try {  
        if (self.isDirectory || self.isLightningType) {
          throw new Error('Cannot get server contents for directories or lightning types currently.');
        } else {
          if (!self.project) {
            throw new Error('Cannot get server contents without a valid project instance.');
          }
          var supportedTypeXmlNames = ['ApexClass','ApexPage','ApexComponent','ApexTrigger'];
          if (supportedTypeXmlNames.indexOf(self.type.xmlName) === -1) {
            throw new Error('serverContents only supports Apex types.');
          }

          var bodyField = (self.type.xmlName === 'ApexPage' || self.type.xmlName === 'ApexComponent') ? 'Markup' : 'Body';
          var soql = 'Select LastModifiedById, LastModifiedDate, LastModifiedBy.Name, '+bodyField+' From '+self.type.xmlName+' Where Name = \''+self.name+'\'';
          self.project.sfdcClient.conn.query(soql, function(err, result) {
            if (err) { 
              logger.debug('could not get server contents: '+err.message);
              return reject(err);
            }
            result.records[0].Body = result.records[0][bodyField];
            resolve(result.records[0]);
          });
        }
      } catch(e){
        logger.debug('Could not determine local store entry: '+e.message);
        reject(e);
      }
    });
  }
});

/**
 * local files in this directory
 */
Object.defineProperty(MavensMateFile.prototype, 'localMembers', {
  get: function() {
    if (!this.isDirectory) {
      throw new Error('localMembers property is only supported for directory types');
    }
    var self = this;
    var contents = [];
    var directoryFiles = fs.readdirSync(self.path);
    _.each(directoryFiles, function(f) {
      contents.push(new MavensMateFile({ path: path.join(self.path, f), project: self.project }));
      if (!path.extname(f)) {
        var subDirectoryFiles = fs.readdirSync(path.join(self.path, f));
        _.each(subDirectoryFiles, function(sf) {  
          contents.push(new MavensMateFile({ path: path.join(self.path, f, sf), project: self.project }));
        });
      }
    });
    return contents;
  }
});

/**
 * Returns base name of the folder (e.g. path/to/src/documents/foldername/foo.txt -> foldername)
 * Currently, salesforce does not support folders nested deeper than 1 level
 * @return {String}
 */
Object.defineProperty(MavensMateFile.prototype, 'folderBaseName', {
  get: function() {
    var folderPath = path.dirname(this.path);
    return path.basename(folderPath);
  },
});

/**
 * template
 * @return {Object}
 */
Object.defineProperty(MavensMateFile.prototype, 'template', {
  get: function() {
    return this._template;
  },
  set: function(value) {
    this._template = value;
  }
});

/**
 * Returns base name of the package.xml subscription
 * @return {String}
 */
Object.defineProperty(MavensMateFile.prototype, 'subscriptionName', {
  get: function() {
    if (this.type.inFolder) {
      if (this.type.xmlName === 'Document') {
        return this.folderBaseName + '/' + this.name + '.' + this.extension;
      } else {
        return this.folderBaseName + '/' + this.name;
      }
    } else {
      return this.name;
    }
  },
});

MavensMateFile.prototype.setTypeByXmlName = function(xmlName) {
  this.type = this.metadataHelper.getTypeByXmlName(xmlName);
};

MavensMateFile.prototype.setAbstractPath = function() {
  this.path = this.type.directoryName + '/' + this.name + '.' + this.type.suffix;
  this.extension = this.type.suffix;
  this.basename = path.basename(this.path);
  this.name = this.basename.split('.')[0];
  this.folderName = path.basename(path.dirname(this.path));
};

/**
 * Returns the MavensMate-Templates template body based on this.template
 * @return {Promise} - resolves with {String} template body
 */
MavensMateFile.prototype._getTemplateBody = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    /*jshint camelcase: false */
    var templateFileName = self.template.file_name; // TODO: standardize format
    var templateSource = config.get('mm_template_source');
    if (templateSource === undefined || templateSource === '') {
      templateSource = 'joeferraro/MavensMate-Templates/master';
    }
    var templateLocation = config.get('mm_template_location');
    if (templateLocation === undefined || templateLocation === '') {
      templateLocation = 'remote';
    }

    var templateBody;
    if (templateLocation === 'remote') {
      request('https://raw.githubusercontent.com/'+templateSource+'/'+self.type.xmlName+'/'+templateFileName, function(error, response, body) {
        if (!error && response.statusCode === 200) {
          templateBody = body;
        } else {
          templateBody = util.getFileBody(path.join(templateSource,self.type.xmlName,templateFileName));
        }
        resolve(templateBody);
      });
    } else {
      templateBody = util.getFileBody(path.join(__dirname,'templates','github',self.type.xmlName,templateFileName));
      resolve(templateBody);
    }
  });
};

/**
 * Renders template and writes to appropriate destination
 * @param  {String} deployPath
 * @return {Promise}
 */
MavensMateFile.prototype.renderAndWriteToDisk = function(destination) {
  var self = this;
  return new Promise(function(resolve, reject) {
    var apiName = self.name;
    swig.setDefaults({ runInVm: true, loader: swig.loaders.fs(__dirname) });
    self._getTemplateBody()
      .then(function(templateBody) {
        var filePath = path.join(destination, self.type.directoryName, [apiName,self.type.suffix].join('.'));
        var fileBody = swig.render(templateBody, { locals: self.templateValues });
        fs.outputFileSync(filePath, fileBody);

        if (self.hasMetaFile) {
          var metaFilePath = path.join(destination, self.type.directoryName, [apiName,self.type.suffix+'-meta.xml'].join('.'));
          var metaFileBody = swig.renderFile(path.join('templates', 'meta.xml'), { 
            metadata: self,
            apiVersion: config.get('mm_api_version')
          });
          fs.outputFileSync(metaFilePath, metaFileBody);
        }
        resolve();
      })
      .catch(function(err) {
        reject(new Error('Could not write metadata file based on template: '+err));
      })
      .done();
    });
};

MavensMateFile.prototype.writeToDiskSync = function(body) {
  body = body || '';
  if (this.isDirectory && this.path) {
    fs.ensureDirSync(this.path);
  } else if (!this.isDirectory && this.path) {
    fs.outputFileSync(this.path, body);
  }
};

MavensMateFile.prototype.deleteLocally = function() {
  if (this.hasMetaFile && fs.existsSync(this.path+'-meta.xml')) {
    fs.remove(this.path+'-meta.xml');
  }
  if (this.existsOnFileSystem) {
    fs.remove(this.path);    
  }
};

module.exports.createFileInstances = function(paths, project) {
  var files = [];
  _.each(paths, function(p) {
    files.push(new MavensMateFile({ path: p, project: project }));
  });
  return files;
};

module.exports.getLightningBundleItemFiles = function(files) {
  return _.filter(files, function(f) { return f.classification === types.LIGHTNING_BUNDLE_ITEM; });
};

module.exports.getToolingFiles = function(files, exludeToolingMetadata) {
  return _.filter(files, function(f) { return !exludeToolingMetadata && f.isToolingType; });
};

module.exports.getMetadataApiFiles = function(files, exludeToolingMetadata) {
  return _.filter(files, function(f) { 
    if (f.isMetaFile) {
      return true;
    } else if (f.classification === types.LIGHTNING_BUNDLE_ITEM) {
      return false;
    } else if (exludeToolingMetadata && f.isToolingType) {
      return false;
    }
    return true;
  });
};

module.exports.createPackageSubscription = function(files, projectPackageXml, exludeToolingMetadata) {
  var subscription = {};
  var projectSubscription = {};
  if (projectPackageXml) {
    projectSubscription = projectPackageXml.subscription;
  }
  _.each(files, function(f) {
    if (f.isToolingType && exludeToolingMetadata) {
      return; // (continue)
    }
    if (f.classification === types.TOP_LEVEL_METADATA_DIRECTORY && projectSubscription) {
      // classes, ApexClass
      subscription[f.type.xmlName] = projectSubscription[f.type.xmlName];
    } else if (f.classification === types.TOP_LEVEL_METADATA_FILE) {
      if (subscription[f.type.xmlName]) {
        if (subscription[f.type.xmlName] !== '*') {
          subscription[f.type.xmlName].push(f.packageName);
        }
      } else {
        subscription[f.type.xmlName] = [ f.packageName ];          
      }
    } else if (f.classification === types.METADATA_FOLDER || f.classification === types.METADATA_FOLDER_ITEM) {
      if (subscription[f.type.xmlName]) {
        subscription[f.type.xmlName].push(f.packageName);
      } else {
        subscription[f.type.xmlName] = [ f.packageName ];          
      }  
    } else if (f.classification === types.LIGHTNING_BUNDLE) {
      if (subscription[f.type.xmlName]) {
        subscription[f.type.xmlName].push(f.packageName);
      } else {
        subscription[f.type.xmlName] = [ f.packageName ];          
      }   
    }
  });
  return subscription;
};

module.exports.types = types;
module.exports.MavensMateFile = MavensMateFile;
