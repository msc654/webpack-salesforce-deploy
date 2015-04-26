'use strict';
var Promise   = require('bluebird');
var path      = require('path');
var util      = require('./util').instance;
var request   = require('request');
var config    = require('./config');

function TemplateService() { }

TemplateService.prototype.getTemplatesForType = function(metadataTypeXmlName) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self._getPackage()
      .then(function(pkg) {
        resolve(pkg[metadataTypeXmlName]);
      })
      .catch(function(e) {
        reject(new Error('Could not retrieve templates for type: '+metadataTypeXmlName+', '+e.message));
      })
      .done();
  });
};

TemplateService.prototype.getTemplateBody = function(metadataTypeXmlName, template) {
  return new Promise(function(resolve, reject) {
    /*jshint camelcase: false */
    var templateFileName = template.file_name; // TODO: standardize format
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
      request('https://raw.githubusercontent.com/'+templateSource+'/'+metadataTypeXmlName+'/'+templateFileName, function(error, response, body) {
        if (!error && response.statusCode === 200) {
          templateBody = body;
        } else {
          templateBody = util.getFileBody(path.join(templateSource,metadataTypeXmlName,templateFileName));
        }
        resolve(templateBody);
      });
    } else {
      templateBody = util.getFileBody(path.join(__dirname,'templates','github',metadataTypeXmlName,templateFileName));
      resolve(templateBody);
    }
  });
};

TemplateService.prototype._getPackage = function() {
  return new Promise(function(resolve, reject) {
    /*jshint camelcase: false */
    try {
      var templateSource = config.get('mm_template_source');
      if (!templateSource) {
        templateSource = 'joeferraro/MavensMate-Templates/master';
      }
      var templateLocation = config.get('mm_template_location');
      if (!templateLocation) {
        templateLocation = 'remote';
      }

      var templatePackage;
      if (templateLocation === 'remote') {
        request('https://raw.githubusercontent.com/'+templateSource+'/package.json', function(error, response, body) {
          if (!error && response.statusCode === 200) {
            templatePackage = JSON.parse(body);
          } else {
            templatePackage = util.getFileBody(path.join(__dirname,'templates','github','package.json'), true);
          }
          resolve(templatePackage);
        });
      } else {
        templatePackage = util.getFileBody(path.join(__dirname,'templates','github','package.json'), true);
        resolve(templatePackage);
      }
    } catch(e) {
      reject(new Error('Could not obtain template package: '+e.message));
    }
    /*jshint camelcase: true */
  });
};

module.exports = TemplateService;