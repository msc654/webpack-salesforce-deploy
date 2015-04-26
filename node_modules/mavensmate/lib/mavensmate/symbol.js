'use strict';

var Promise = require('bluebird');
var _       = require('lodash');
var logger  = require('winston');
var util    = require('./util').instance;
var fs      = require('fs-extra');
var path    = require('path');

var SymbolService = function(project) {
  this.project = project;
};

SymbolService.prototype.index = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    self._getApexClassNames()
      .then(function(classNames) {
        var symbolPromises = [];
        var classNameArrays = util.chunkArray(classNames, 10);
        logger.debug(classNameArrays);
        _.each(classNameArrays, function(classNames) {
          symbolPromises.push(self._getSymbolsForClassNames(classNames));
        });
        return Promise.all(symbolPromises);
      })
      .then(function(symbolPromiseResults) {
        logger.debug(self.classMap);
        var writeSymbolPromises = [];
        _.each(symbolPromiseResults, function(res) {
          _.each(res.records, function(symbolQueryResult) {
            writeSymbolPromises.push(self._writeSymbolTable(symbolQueryResult));
          });
        });
        return Promise.all(writeSymbolPromises);
      })
      .then(function() {
        resolve();
      })
      .catch(function(err) {
        reject(new Error('Could not index Apex Symbols: '+err.message));
      })
      .done();
  });
};

SymbolService.prototype.indexApexClass = function(apexClassName) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self._getSymbolsForClassNames([apexClassName])
      .then(function(symbolQueryResult) {
        return self._writeSymbolTable(symbolQueryResult.records[0]);
      })
      .then(function() {
        resolve();
      })
      .catch(function(err) {
        reject(new Error('Could not index Apex Symbols: '+err.message));
      })
      .done();
  });
};

SymbolService.prototype._writeSymbolTable = function(symbolQueryResult) {
  var self = this;
  return new Promise(function(resolve, reject) {
    fs.outputFile(path.join(self.project.path, 'config', '.symbols', symbolQueryResult.Name+'.json'), JSON.stringify(symbolQueryResult.SymbolTable, null, 4), function(err) {
      if (err) {
        reject(err);  
      } else {
        resolve();
      }
    });
  });
};

SymbolService.prototype._getSymbolsForClassNames = function(classNames) {
  var self = this;
  return new Promise(function(resolve, reject) {
    logger.debug('_getSymbolsForClassNames:');
    logger.debug(classNames);

    var fields = ['NamespacePrefix', 'SymbolTable', 'Name'];
    var query = 'SELECT '+fields.join(',')+' FROM ApexClass WHERE NAME IN ('+util.joinForQuery(classNames)+')';

    self.project.sfdcClient.conn.tooling.query(query, function(err, res) {
      if (err) { 
        reject(new Error('error retrieving symbols: '+err.message));
      } else {
        resolve(res);
      }
    });
  });  
};

SymbolService.prototype._getApexClassNames = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.project.sfdcClient.list('ApexClass')
      .then(function(res) {
        var classNames = [];
        _.each(res.ApexClass, function(cls) {
          classNames.push(cls.fullName);
        });
        resolve(classNames);
      })
      .catch(function(err) {
        reject(new Error('Could not get class names: '+err.message));
      })
      .done();
  });
};

module.exports = SymbolService;