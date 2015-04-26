'use strict';

var jobQueue = require('../../job-queue');

var ApexController = function(req) {
  this.client = req.app.get('client');
  this.swig = req.app.get('swig');
};

/**
 * GET
 */
ApexController.prototype.new = function(req, res) {
  res.render('execute_apex/index.html');
};

/**
 * POST (async)
 */
ApexController.prototype.execute = function(req, res) {
  var jobId = jobQueue.addJob();

  this.client.executeCommand('execute-apex', req.body, function(err, commandResult) {
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


module.exports = ApexController;