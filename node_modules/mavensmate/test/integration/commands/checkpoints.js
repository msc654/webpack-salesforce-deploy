'use strict';

var helper            = require('../../test-helper');
var chai              = require('chai');
var should            = chai.should();
var path              = require('path');
var CheckpointService = require('../../../lib/mavensmate/checkpoint');

describe('mavensmate checkpoints', function(){

  var project;
  var testClient;

  before(function(done) {
    this.timeout(15000);
    testClient = helper.createClient('atom');
    helper.unlinkEditor();
    helper.putTestProjectInTestWorkspace(testClient, 'checkpoints');
    helper.setProject(testClient, 'checkpoints', function(err, proj) {
      project = proj;
      testClient.executeCommand('update-subscription', { subscription: ['ApexClass'] }, function(err, response) {
        testClient.executeCommand('index-metadata', function(err) {
          if (err) {
            done(err);
          } else {
            var cs = new CheckpointService(project);
            cs.deleteCheckpointsForCurrentUser()
              .then(function() {
                done();
              })
              .catch(function(err) {
                done(err);
              });
          }
        });
      });
    });
  });

  after(function(done) {
    this.timeout(15000);
    var filesToDelete = [
      path.join(helper.baseTestDirectory(),'workspace', 'checkpoints', 'src', 'classes', 'CheckpointClass.cls')
    ];
    helper.cleanUpTestData(testClient, filesToDelete)
      .then(function() {
        return helper.cleanUpTestProject('checkpoints');
      })
      .then(function() {
        done();
      });
  });


  it('should add checkpoint', function(done) {
    this.timeout(8000);

    helper.createNewMetadata(testClient, 'ApexClass', 'CheckpointClass')
      .then(function(response) {          
        var payload = {
          path: path.join(helper.baseTestDirectory(),'workspace', 'checkpoints', 'src', 'classes', 'CheckpointClass.cls'),
          lineNumber : 1
        };
        testClient.executeCommand('new-checkpoint', payload, function(err, response) {
          should.equal(err, null);
          response.should.have.property('result');
          response.result.success.should.equal(true);
          response.result.id.length.should.equal(18);
          done();
        });
      })
      .done();
  });

  it('should list checkpoints', function(done) {
    this.timeout(8000);
    var payload = {
      path: path.join(helper.baseTestDirectory(),'workspace', 'checkpoints', 'src', 'classes', 'CheckpointClass.cls')
    };
    testClient.executeCommand('list-checkpoints', payload, function(err, response) {
      should.equal(err, null);
      response.should.have.property('result');
      response.result.size.should.equal(1);
      response.result.records.length.should.equal(1);
      done();
    });
  });

  it('should delete checkpoint', function(done) {
    this.timeout(8000);
    var payload = {
      path: path.join(helper.baseTestDirectory(),'workspace', 'checkpoints', 'src', 'classes', 'CheckpointClass.cls'),
      lineNumber : 1
    };
    testClient.executeCommand('delete-checkpoint', payload, function(err, response) {
      should.equal(err, null);
      response.should.have.property('result');
      response.result.success.should.equal(true);
      response.result.id.length.should.equal(18);
      done();
    });
  });

});

