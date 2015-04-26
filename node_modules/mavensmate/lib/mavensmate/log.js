'use strict';

var Promise   = require('bluebird');
var fs        = require('fs-extra');
var path      = require('path');
var moment    = require('moment');
var events    = require('events');
var inherits  = require('inherits');

var LogService = function(project) {
  this.project = project;
};

inherits(LogService, events.EventEmitter);

LogService.prototype.downloadLog = function(logId) {
  var self = this;
  return new Promise(function(resolve, reject) {
    // create test name directory in debug/tests
    if (!fs.existsSync(path.join(self.project.path, 'debug', 'logs'))) {
      fs.mkdirpSync(path.join(self.project.path, 'debug', 'logs'));
    }

    var url = self.project.sfdcClient.conn.tooling._baseUrl() + '/sobjects/ApexLog/'+logId+'/Body';
    self.project.sfdcClient.conn.tooling._request(url, function(err, res) {
      if (err) { 
        reject(new Error('Could not download log: '+err.message));  
      } else {
        var logFileName = [moment().format('YYYY-MM-DD HH-mm-ss'), 'log'].join('.');
        var filePath = path.join(self.project.path, 'debug', 'logs', logFileName);
        fs.outputFile(filePath, res, function(e) {
          if (e) {
            reject(new Error('Could not write log file: '+e.message));  
          } else {
            self.emit('mavensmate-log-downloaded', filePath);
            resolve(filePath);
          }
        });
      }
    });
  });
};

module.exports = LogService;