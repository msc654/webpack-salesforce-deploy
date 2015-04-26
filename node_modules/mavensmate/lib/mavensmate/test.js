'use strict';
var Promise   = require('bluebird');
var _         = require('lodash');
var path      = require('path');
var util      = require('./util').instance;
var events    = require('events');
var inherits  = require('inherits');
var fs        = require('fs-extra');
var logger    = require('winston');
var moment    = require('moment');

// Q.longStackSupport = true;

/**
 * Represents an apex test execution
 * @param {Object} opts
 * @param {Array} opts.project - instance of Project
 * @param {Array} opts.tests - array of test names, either an array of paths ['/path/to/test1.cls'] or ['test1.cls']
 * @param {Array} opts.debugCategories - array of debug categories for the deployment
 */
function ApexTest(opts) {
  opts.tests = opts.tests || opts.classes || opts.paths || [];
  util.applyProperties(this, opts);
  this._initialize();
}

inherits(ApexTest, events.EventEmitter);

ApexTest.prototype._initialize = function() {
  var tests = [];
  var self = this;
  self.apexClassOrTriggerIdToName = {};

  _.each(this.tests, function(t) {
    if (t.indexOf(path.sep) !== -1) {
      if (t.indexOf(self.project.path) === -1) {
        throw new Error('Test does not exist in this project: '+t);
      }
    } else {
      if (t.indexOf('.') === -1) {
        t = t+'.cls';
      }
      var fullPath = path.join(self.project.path, 'src', 'classes', t);
      // console.log(fullPath);
      if (fullPath.indexOf(self.project.path) === -1 || !fs.existsSync(fullPath)) {
        throw new Error('Test does not exist in this project: '+t);
      }
    }
    tests.push(t.indexOf(path.sep) !== -1 ? path.basename(t) : t);
  });
  this.tests = tests;
};

/**
 * Executes requested tests
 * @return {Promise} resolves with {Object}
 */
ApexTest.prototype.execute = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    var localStore = self.project.getLocalStore();
    var tests = [];
    var testClassIds = [];
    _.each(self.tests, function(test) {
      // console.log(test);
      var apexClassId = localStore[test].id;
      tests.push({
        ApexClassId: apexClassId
      });
      testClassIds.push(apexClassId);
    });

    logger.debug('running the following tests: ');
    logger.debug(tests);

    var classResults;
    var methodResults;
    var projectClassIds = [];
    var projectTriggerIds = [];
    var coverageResults = {};
    var testResults = {};

    self.project.sfdcClient.runTests(tests)
      .then(function(results) {
        classResults = results.classResults;
        methodResults = results.methodResults;
        _.forOwn(self.project.getLocalStore(), function(value, key) {
          if (util.endsWith(key, '.cls')) {
            projectClassIds.push(value.id);
            self.apexClassOrTriggerIdToName[value.id] = value.fullName;
          } else if (util.endsWith(key, '.trigger')) {
            projectTriggerIds.push(value.id);
            self.apexClassOrTriggerIdToName[value.id] = value.fullName;
          }
        });
        return self.getCoverage(projectClassIds, testClassIds);
      })
      .then(function(classCoverageResults) {
        coverageResults.classes = classCoverageResults;
        return self.getCoverage(projectTriggerIds, testClassIds);
      })
      .then(function(triggerCoverageResults) {
        coverageResults.triggers = triggerCoverageResults;

        _.each(classResults.records, function(classResult) {
          var key = classResult.ApexClass.Name;
          testResults[key] = classResult;
          testResults[key].results = _.where(methodResults.records, { ApexClassId : classResult.ApexClassId }); 
        });

        var logDownloadPromises = [];
        var logIdsToDownload = [];

        // console.log('looping methodResults');
        // console.log(methodResults);

        _.each(methodResults.records, function(r) {
          if (r.ApexLogId && logIdsToDownload.indexOf(r.ApexLogId) === -1) {
            logIdsToDownload.push(r.ApexLogId);
            logDownloadPromises.push(self._downloadLog(r.ApexClass.Name, r.ApexLogId));
          }
        });
        return Promise.all(logDownloadPromises);
      })
      .then(function() {
        resolve({ testResults: testResults, coverageResults: coverageResults });
      })
      .catch(function(err) {
        reject(new Error('Could not run tests: '+err.message));
      })
      .done();
  });
};

ApexTest.prototype.getOrgWideCoverage = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    var query = 'SELECT PercentCovered FROM ApexOrgWideCoverage';
    self.project.sfdcClient.conn.tooling.query(query, function(err, res) {
      if (err) { 
        reject(err);
      } else {
        resolve(res.records[0].PercentCovered);
      }
    });
  });  
};

ApexTest.prototype.getCoverage = function(classOrTriggerIds, testClassIds) {
  var self = this;
  return new Promise(function(resolve, reject) {
    var coverageObject = 'ApexCodeCoverage';
    if (testClassIds === undefined) {
      coverageObject = 'ApexCodeCoverageAggregate';
    }

    var fields = ['NumLinesCovered', 'NumLinesUncovered', 'Coverage', 'ApexClassOrTriggerId'];
    var query = 'SELECT '+fields.join(',')+ ' FROM '+coverageObject+' WHERE ApexClassOrTriggerId IN ('+util.joinForQuery(classOrTriggerIds)+')';

    if (testClassIds !== undefined && testClassIds.length > 0) {
      query += ' AND ApexTestClassId IN ('+util.joinForQuery(testClassIds)+')';
    }

    self.project.sfdcClient.conn.tooling.query(query, function(err, res) {
      if (err) { 
        reject(err);
      } else {
        self._aggregateCoverage(res)
          .then(function(res) {
            resolve(res);
          })
          .catch(function(err) {
            reject(new Error('Could not get coverage: '+err.message));
          })
          .done();
      }
    });
  });
};

ApexTest.prototype._downloadLog = function(testName, logId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    // create test name directory in debug/tests
    if (!fs.existsSync(path.join(self.project.path, 'debug', 'tests', testName))) {
      fs.mkdirpSync(path.join(self.project.path, 'debug', 'tests', testName));
    }

    var url = self.project.sfdcClient.conn.tooling._baseUrl() + '/sobjects/ApexLog/'+logId+'/Body';
    self.project.sfdcClient.conn.tooling._request(url, function(err, res) {
      if (err) { 
        reject(new Error('Could not download log: '+err.message));  
      } else {
        var logFileName = [moment().format('YYYY-MM-DD HH-mm-ss'), 'log'].join('.');
        var filePath = path.join(self.project.path, 'debug', 'tests', testName, logFileName);
        fs.outputFile(filePath, res, function(e) {
          if (e) {
            reject(new Error('Could not write log file: '+e.message));  
          } else {
            resolve();
          }
        });
      }
    });
  });
};

/** 
 * Transforms a CodeCoverage result into a dictionary of aggregate coverage results, keyed by the class name
 * @return {Promise}
 */
ApexTest.prototype._aggregateCoverage = function(coverageResults) {
  var self = this; 
  return new Promise(function(resolve, reject) {
    try {
      var result = {}; // { "MyClass.cls" : { "coveredLines" : 5, "uncoveredLines" : 10 } } 
      _.each(coverageResults.records, function(coverageResult) {
        
        // console.log('coverage result : -->');
        // console.log(coverageResult);
        
        var classOrTriggerName = self.apexClassOrTriggerIdToName[coverageResult.ApexClassOrTriggerId];

        // console.log(classOrTriggerName);

        if (!_.has(result, coverageResult.ApexClassOrTriggerId)) {
          result[classOrTriggerName] = {};
          result[classOrTriggerName].coveredLines = coverageResult.Coverage.coveredLines;
          result[classOrTriggerName].uncoveredLines = coverageResult.Coverage.uncoveredLines;
        } else {
          var currentValue = result[classOrTriggerName];
          currentValue.coveredLines = _.union(currentValue.coveredLines, coverageResult.Coverage.coveredLines);
          currentValue.uncoveredLines = _.union(currentValue.uncoveredLines, coverageResult.Coverage.uncoveredLines);
        }
      });

      // coveredLines: [
      //   3, 4, 5
      // ]

      // uncoveredLines: [
      //   1, 2, 3
      // ]
      // 
      // => [1, 2]

      _.forOwn(result, function(coverageResult, apexClassOrTriggerId) {
        // console.log('for apexClassOrTriggerId: '+apexClassOrTriggerId);
        coverageResult.uncoveredLines = _.difference(coverageResult.uncoveredLines, coverageResult.coveredLines);
        coverageResult.totalLines = coverageResult.coveredLines.length + coverageResult.uncoveredLines.length;
        if (coverageResult.totalLines === 0) {
          coverageResult.percentCovered = 0;
        } else {
          coverageResult.percentCovered = Math.round(parseFloat(coverageResult.coveredLines.length / coverageResult.totalLines * 100));
        }
      });

      resolve(result);
    } catch(e) {
      reject(new Error('Could not aggregate coverage: '+e.message)); 
    }
  }); 
};

module.exports = ApexTest;