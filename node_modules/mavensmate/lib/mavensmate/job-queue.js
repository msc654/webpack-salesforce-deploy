'use strict';

var _         = require('underscore-plus');
var uuid      = require('node-uuid');
var events    = require('events');
var inherits  = require('inherits');

var JobQueue = function(){};

inherits(JobQueue, events.EventEmitter);

JobQueue.prototype.tracked = {};

JobQueue.prototype.addJob = function(operation) {
  var job, jobId;
  jobId = uuid.v1();
  job = {
    id: jobId,
    complete: false,
    operation: operation
  };
  this.tracked[jobId] = job;
  return jobId;
};

JobQueue.prototype.start = function(jobId, job) {
  return this.tracked[jobId].work = job.then(this.finish);
};

JobQueue.prototype.isJobComplete = function(jobId) {
  return this.tracked[jobId].complete;
};

JobQueue.prototype.getResultForId = function(jobId) {
  var p = _.clone(this.tracked[jobId]);
  delete this.tracked[jobId];
  return p;
};

/**
 * TODO: we're doing a lot of gymnastics with the error/result objects, need to standardize with command.js's respond
 * @param  {String} jobId  - id of the job to finish
 * @param  {Object} error  - should be an error object, but see TODO
 * @param  {Object} result - result object, typically formatted like { response: {  } }
 * @return {Nothing}        
 */
JobQueue.prototype.finish = function(jobId, error, result) {
  if (result && result.result) {
    this.tracked[jobId].result = result.result; // TODO: formalize response format
  } else if (result) {
    this.tracked[jobId].result = result;
  }
  if (error) {
    if (error instanceof Error) {
      this.tracked[jobId].error = error.message;
      this.tracked[jobId].stack = error.stack;
    } else {
      this.tracked[jobId].error = error.error;
      this.tracked[jobId].stack = error.stack;
    }
  }
  this.tracked[jobId].complete = true;
};

module.exports = new JobQueue();