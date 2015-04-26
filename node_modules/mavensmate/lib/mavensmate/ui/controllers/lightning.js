'use strict';

var jobQueue = require('../../job-queue');

var LightningController = function(req) {
  this.client = req.app.get('client');
};

/**
 * GET (sync)
 */
LightningController.prototype.newApp = function(req, res) {
  res.render('lightning/new_app.html');
};

/**
 * GET (sync)
 */
LightningController.prototype.newComponent = function(req, res) {
  res.render('lightning/new_component.html');
};

/**
 * GET (sync)
 */
LightningController.prototype.newEvent = function(req, res) {
  res.render('lightning/new_event.html');
};

/**
 * GET (sync)
 */
LightningController.prototype.newInterface = function(req, res) {
  res.render('lightning/new_interface.html');
};

/**
 * create a new lightning app
 * POST (async)
 */
LightningController.prototype.createApp = function(req, res) {
  var jobId = jobQueue.addJob();

  this.client.executeCommand('new-lightning-app', req.body, function(err, commandResult) {
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
 * create a new lightning component
 * POST (async)
 */
LightningController.prototype.createComponent = function(req, res) {
  var jobId = jobQueue.addJob();

  this.client.executeCommand('new-lightning-component', req.body, function(err, commandResult) {
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
 * create a new lightning event
 * POST (async)
 */
LightningController.prototype.createEvent = function(req, res) {
  var jobId = jobQueue.addJob();

  this.client.executeCommand('new-lightning-event', req.body, function(err, commandResult) {
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
 * create a new lightning interface
 * POST (async)
 */
LightningController.prototype.createInterface = function(req, res) {
  var jobId = jobQueue.addJob();

  this.client.executeCommand('new-lightning-interface', req.body, function(err, commandResult) {
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

module.exports = LightningController;