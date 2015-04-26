'use strict';

var DeployController  = require('../../../lib/mavensmate/ui/controllers/deploy');
var sinon             = require('sinon');
var helper            = require('../../test-helper');

describe('mavensmate DeployController', function(){

  var project;
  var testClient;

  before(function(done) {
    this.timeout(10000);
    testClient = helper.createClient('atom');
    helper.putTestProjectInTestWorkspace(testClient, 'DeployControllerTest');
    helper.setProject(testClient, 'DeployControllerTest', function(err, proj) {
      project = proj;
      done();
    });
  });

  after(function(done) {
    helper.cleanUpTestProject('DeployControllerTest')
      .then(function() {
        done();
      });
  });

  describe('views', function() {
    
    var ctrl;

    beforeEach(function() {
      ctrl = new DeployController({
        app : {
          get: function(what) {
            if (what === 'client') {
              return testClient;
            }
          }
        }
      });
    });

    it('should render deploy/new.html', function(done) {    
      var req,res,spy;
      req = res = {};
      spy = testClient.executeCommand = sinon.spy();

      ctrl.new(req, res);
      spy.calledOnce.should.equal(true);
      done();
    });
  });

  describe('execute', function() {
    
    var ctrl;

    beforeEach(function() {
      ctrl = new DeployController({
        app : {
          get: function(what) {
            if (what === 'client') {
              return testClient;
            }
          }
        }
      });
    });

    it('should call execute', function(done) {    
      var req,res,spy;
      req = res = { send: function() {} };
      spy = testClient.executeCommand = sinon.spy();

      ctrl.execute(req, res);
      spy.calledOnce.should.equal(true);
      done();
    });
  });

  describe('getConnections', function() {
    
    var ctrl;

    beforeEach(function() {
      ctrl = new DeployController({
        app : {
          get: function(what) {
            if (what === 'client') {
              return testClient;
            }
          }
        }
      });
    });

    it('should call getConnections', function(done) {    
      var req,res,spy;
      req = res = { send: function() {} };
      spy = testClient.executeCommand = sinon.spy();

      ctrl.getConnections(req, res);
      spy.calledOnce.should.equal(true);
      done();
    });
  });

  describe('newConnection', function() {
    
    var ctrl;

    beforeEach(function() {
      ctrl = new DeployController({
        app : {
          get: function(what) {
            if (what === 'client') {
              return testClient;
            }
          }
        }
      });
    });

    it('should call newConnection', function(done) {    
      var req,res,spy;
      req = res = { send: function() {} };
      spy = testClient.executeCommand = sinon.spy();

      ctrl.newConnection(req, res);
      spy.calledOnce.should.equal(true);
      done();
    });
  });

  describe('deleteConnection', function() {
    
    var ctrl;

    beforeEach(function() {
      ctrl = new DeployController({
        app : {
          get: function(what) {
            if (what === 'client') {
              return testClient;
            }
          }
        }
      });
    });

    it('should call deleteConnection', function(done) {    
      var req,res,spy;
      req = res = { send: function() {} };
      spy = testClient.executeCommand = sinon.spy();

      ctrl.deleteConnection(req, res);
      spy.calledOnce.should.equal(true);
      done();
    });
  });

});


