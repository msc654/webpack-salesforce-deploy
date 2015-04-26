'use strict';

var helper  = require('../test-helper');
var chai    = require('chai');
var fs      = require('fs-extra');
var path    = require('path');
var Project = require('../../lib/mavensmate/project');
var assert  = chai.assert;

chai.use(require('chai-fs'));

describe('mavensmate project-unit', function(){

  describe('initiate new', function () {
    it('should select a workspace when setting is a string', function (done) {
      this.timeout(8000);
      /*jshint camelcase: false */
      process.env.mm_workspace = path.join(helper.baseTestDirectory(), 'workspace');
      /*jshint camelcase: true */
      helper.createClient('sublime');
      var project = new Project({
        name: 'foo'
      });
      project._initNew()
        .then(function() {
          project.workspace.should.equal(path.join(helper.baseTestDirectory(), 'workspace'));
          /*jshint camelcase: false */
          delete process.env.mm_workspace;
          /*jshint camelcase: true */
          done();
        });
    });

    it('should select a workspace when setting is an array', function (done) {
      this.timeout(8000);
      /*jshint camelcase: false */
      helper.createClient('sublime', {
        mm_workspace : [
          path.join(helper.baseTestDirectory(), 'workspace'), 
          path.join(helper.baseTestDirectory(), 'workspace', 'foo') 
        ]
      });
      /*jshint camelcase: true */
      var project = new Project({
        name: 'foo'
      });
      project._initNew()
        .then(function() {
          project.workspace.should.equal(path.join(helper.baseTestDirectory(), 'workspace'));
          done();
        });
    });

    it('should create the workspace when it does not exist', function (done) {
      this.timeout(8000);
      helper.createClient('sublime');
      /*jshint camelcase: false */
      helper.createClient('sublime', {
        mm_workspace : [
          path.join(helper.baseTestDirectory(), 'workspace', 'foo'), 
          path.join(helper.baseTestDirectory(), 'workspace') 
        ]
      });
      /*jshint camelcase: true */
      var project = new Project({
        name: 'foo'
      });
      project._initNew()
        .then(function() {
          project.workspace.should.equal(path.join(helper.baseTestDirectory(), 'workspace', 'foo'));
          assert.isDirectory(path.join(helper.baseTestDirectory(), 'workspace', 'foo'),  'Workspace not created');
          fs.removeSync(path.join(helper.baseTestDirectory(), 'workspace', 'foo'));
          done();
        });
    });
  });
});
