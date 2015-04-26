'use strict';

var path    = require('path');
var fs      = require('fs-extra');
var util    = require('../util').instance;
var _       = require('lodash');
var config  = require('../config');


var ViewHelper = function(opts) {
  util.applyProperties(this, opts);
};

ViewHelper.prototype.util = util;
ViewHelper.prototype.config = config;

ViewHelper.prototype.getClient = function() {
  return this.client;
};

ViewHelper.prototype.getStaticResourcePath = function() {
  return this.getBaseUrl() + '/app/static';
};

ViewHelper.prototype.getBaseUrl = function() {
  return 'http://127.0.0.1:'+this.port;
};

ViewHelper.prototype.getDefaultSubscription = function() {
  return config.get('mm_default_subscription');
};

ViewHelper.prototype.getWorkspaces = function() {
  var workspaces = config.get('mm_workspace');
  if (!_.isArray(workspaces)) {
    workspaces = [workspaces];
  }
  return workspaces;
};

ViewHelper.prototype.getMetadataObjects = function() {
  return _.sortBy(this.getProject().getDescribe().metadataObjects, 'xmlName');
};

ViewHelper.prototype.getProjectSubscription = function() {
  return this.getProject().getSubscription() || [];
};

ViewHelper.prototype.getProject = function() {
  return this.project || this.client.getProject();
};

ViewHelper.prototype.getSalesforceClient = function() {
  return (this.getProject()) ? this.getProject().sfdcClient : undefined;
};

ViewHelper.prototype.getProjectPath = function() {
  return this.getProject() !== undefined ? this.getProject().path : '';
};

ViewHelper.prototype.getCoverageCssClass = function(percentCovered) {
  if (percentCovered <= 40) {
    return 'danger';
  } else if (percentCovered < 75) {
    return 'warning';
  } else {
    return 'success';
  }
};

ViewHelper.prototype.doesClassOrTriggerExist = function(classOrTriggerName, type) {
  var self = this;
  if (type === 'ApexClass') {
    return fs.existsSync(path.join(self.getProject().path), 'src', 'classes', classOrTriggerName+'.cls');
  } else if (type === 'ApexTrigger') {
    return fs.existsSync(path.join(self.getProject().path), 'src', 'triggers', classOrTriggerName+'.trigger');
  }
};

ViewHelper.prototype.getFileLines = function(classOrTriggerName, type) {
  var self = this;
  if (type === 'ApexClass') {
    return fs.readFileSync(path.join(self.getProject().path, 'src', 'classes', classOrTriggerName+'.cls'), 'utf8').toString().split(require('os').EOL);
  } else if (type === 'ApexTrigger') {
    return fs.readFileSync(path.join(self.getProject().path, 'src', 'triggers', classOrTriggerName+'.trigger'), 'utf8').toString().split(require('os').EOL);
  }
};

ViewHelper.prototype.htmlize = function(str) {
  try {
    str = str.replace(/&/g, '&amp;');
    str = str.replace(/"/g, '&quot;');
    str = str.replace(/</g, '&lt;');
    str = str.replace(/>/g, '&gt;');
    str = str.replace(/\n/g, '<br/>');
    str = str.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
    str = str.replace(/\s/g, '&nbsp;');
    return str;
  } catch(e) {
    return str;
  }
};

ViewHelper.prototype.getDeployMessageFileNameBaseName = function(str) {
  return str.split('/').pop();
};

ViewHelper.prototype.isFalse = function(input) {
  return input === false || input === 'false' || input === 0;
};

ViewHelper.prototype.isTrue = function(input) {
  return input === true || input === 'true' || input === 1;
};


module.exports = ViewHelper;