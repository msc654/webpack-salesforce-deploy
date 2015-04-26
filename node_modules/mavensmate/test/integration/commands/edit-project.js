'use strict';

var helper        = require('../../test-helper');
var chai          = require('chai');
var path          = require('path');
var should        = chai.should();
var fs            = require('fs-extra');

chai.use(require('chai-fs'));

describe('mavensmate edit-project', function(){

  var project;
  var testClient;

  before(function(done) {
    this.timeout(8000);
    helper.unlinkEditor();
    testClient = helper.createClient('atom');
    helper.putTestProjectInTestWorkspace(testClient, 'edit-project');
    helper.setProject(testClient, 'edit-project', function(err, proj) {
      project = proj;
      done();
    });
  });

  after(function(done) {
    this.timeout(4000);
    helper.cleanUpTestProject('edit-project')
      .then(function() {
        done();
      });
  });

  it('should edit project contents', function(done) {
    this.timeout(20000);      

    testClient.executeCommand('edit-project', { package: { CustomObject: 'Account' } }, function(err, response) {
      should.equal(err, null);
      should.not.equal(response, null);

      var accountPath = path.join(testClient.getProject().path, 'src', 'objects', 'Account.object');
      fs.existsSync(accountPath).should.equal(true);

      var classPath = path.join(testClient.getProject().path, 'src', 'classes');
      var triggerPath = path.join(testClient.getProject().path, 'src', 'triggers');
      fs.existsSync(classPath).should.equal(false);
      fs.existsSync(triggerPath).should.equal(false);

      done();
    });
  });

  it('should fail to update project creds because of invalid login', function(done) {
    this.timeout(10000);      

    testClient.executeCommand('update-creds', { username: 'thiswontwork@foo.com', password: 'foo' }, function(err, response) {
      should.equal(response, undefined);
      err.should.have.property('error');
      err.error.should.contain('Could not log in to Salesforce.com: Error: INVALID_LOGIN: Invalid username, password, security token; or user locked out');
      done();
    });
  });

  it('should update project creds', function(done) {
    this.timeout(10000);      

    testClient.executeCommand('update-creds', { 
      username: process.env.SALESFORCE_USERNAME || 'mm@force.com', 
      password: process.env.SALESFORCE_PASSWORD || 'force' 
    }, function(err, response) {
      console.log(err);
      console.log(response);
      should.equal(err, null);
      response.should.have.property('result');
      response.result.should.equal('Credentials updated successfully!');
      done();
    });
  });

});
