'use strict';

var jobQueue        = require('../../job-queue');

var DeployController = function(req) {
  this.client = req.app.get('client');
  this.swig = req.app.get('swig');
};

/**
 * GET
 */
DeployController.prototype.new = function(req, res) {
  var self = this;
  this.client.executeCommand('get-connections', function(err, commandResult) {
    if (err) {
      res.send(err); 
    } else {
      res.render('deploy/index.html', {
        connections: commandResult.result,
        hasIndexedMetadata: self.client.getProject().hasIndexedMetadata()
      });
    }
  });
};

/**
 * POST (async)
 */
DeployController.prototype.execute = function(req, res) {
  var jobId = jobQueue.addJob();
  var self = this;
  this.client.executeCommand('deploy', req.body, function(err, commandResult) {
    if (err) {
      jobQueue.finish(jobId, err, null);  
    } else {
      // console.log(commandResult);
      var resultHtml = self.swig.renderFile('ui/templates/deploy/result.html', {
        results: commandResult.result,
        targets: req.body.destinations,
        deployOptions: req.body.deployOptions
      });
      var result = {
        html: resultHtml,
        object: commandResult.result
      };
      jobQueue.finish(jobId, null, result);  
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
DeployController.prototype.getConnections = function(req, res) {
  this.client.executeCommand('get-connections', function(err, commandResult) {
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
DeployController.prototype.newConnection = function(req, res) {
  this.client.executeCommand('new-connection', req.body, function(err, commandResult) {
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
DeployController.prototype.deleteConnection = function(req, res) {
  this.client.executeCommand('delete-connection', req.body, function(err, commandResult) {
    if (err) {
      res.send(err); 
    } else {
      res.send(commandResult); 
    }
  });
};




module.exports = DeployController;