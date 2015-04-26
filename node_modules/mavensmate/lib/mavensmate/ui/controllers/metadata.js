'use strict';

var Promise         = require('bluebird');
var jobQueue        = require('../../job-queue');
var TemplateService = require('../../template');

var MetadataController = function(req) {
  this.client = req.app.get('client');
  this.swig = req.app.get('swig');
  this.templateService = new TemplateService();
};

MetadataController.prototype._getTemplates = function(typeXmlName) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.templateService.getTemplatesForType(typeXmlName)
      .then(function(templates) {
        resolve(templates);
      })
      .catch(function(e) {
        reject(new Error('Could not retrieve templates: '+e.message));
      })
      .done();
  });
};

/**
 * GET (sync)
 */
MetadataController.prototype.new = function(req, res) {
  this._getTemplates(req.query.type)
    .then(function(templates) {
      var locals = {
        templates : templates,
        metadataType: req.query.type
      };
      res.render('metadata/new.html', locals);
    })
    .catch(function(e) {
      res.render('metadata/new.html', {});
    })
    .done();
};

// /**
//  * GET (sync)
//  */
// MetadataController.prototype.template = function(req, res) {
//  this.templateService.getTemplateBody(typeXmlName)
//    .then(function(templates) {
//      resolve(templates);
//    })
//    .catch(function(e) {
//      reject(new Error('Could not retrieve templates: '+e.message));
//    })
//    .done();
// };

/**
 * POST (async)
 */
MetadataController.prototype.create = function(req, res) {
  var jobId = jobQueue.addJob();

  this.client.executeCommand('new-metadata', req.body, function(err, commandResult) {
    if (err) {
      jobQueue.finish(jobId, err, null);  
    } else {
      jobQueue.finish(jobId, null, commandResult);  
    }
  });
  
  return res.send({
    status: 'pending',
    id: jobId
  });
};

module.exports = MetadataController;