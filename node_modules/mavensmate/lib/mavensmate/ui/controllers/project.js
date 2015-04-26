'use strict';

var jobQueue        = require('../../job-queue');
var logger          = require('winston');

var ProjectController = function(req) {
  this.client = req.app.get('client');
  this.swig = req.app.get('swig');
};

/**
 * GET
 */
ProjectController.prototype.new = function(req, res) {
  res.render('project/new.html');
};

/**
 * GET
 */
ProjectController.prototype.edit = function(req, res) {
  res.render('project/edit.html');
};


/**
 * POST (async)
 */
ProjectController.prototype.create = function(req, res) {
  var jobId = jobQueue.addJob();

  logger.debug('received request to execute tests asynchronously: ');
  logger.debug(req.body);

  this.client.executeCommand('new-project', req.body, function(err, commandResult) {
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

/**
 * POST (async)
 */
ProjectController.prototype.update = function(req, res) {
  var jobId = jobQueue.addJob();

  this.client.executeCommand('edit-project', req.body, function(err, commandResult) {
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

/**
 * POST (sync)
 */
ProjectController.prototype.updateCreds = function(req, res) {
  this.client.executeCommand('update-creds', req.body, function(err, commandResult) {
    if (err) {
      res.send(err); 
    } else {
      res.send(commandResult); 
    }
  });
};

/**
 * POST (sync)
 */
ProjectController.prototype.updateSubscription = function(req, res) {
  this.client.executeCommand('update-subscription', req.body, function(err, commandResult) {
    if (err) {
      res.send(err); 
    } else {
      res.send(commandResult); 
    }
  });
};

/**
 * POST (async)
 */
ProjectController.prototype.indexMetadata = function(req, res) {
  var jobId = jobQueue.addJob();

  this.client.executeCommand('index-metadata', req.body, function(err, commandResult) {
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

/**
 * GET (sync)
 */
ProjectController.prototype.getIndex = function(req, res) {
  this.client.executeCommand('get-metadata-index', function(err, commandResult) {
    if (err) {
      res.send(err); 
    } else {
      res.send(commandResult); 
    }
  });
};

/**
 * GET (sync)
 */
ProjectController.prototype.session = function(req, res) {
  this.client.executeCommand('session', req.query, function(err, commandResult) {
    if (err) {
      res.send(err); 
    } else {
      res.send(commandResult); 
    }
  });
};

module.exports = ProjectController;