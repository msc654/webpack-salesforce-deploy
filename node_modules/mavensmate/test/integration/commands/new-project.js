'use strict';

var helper        = require('../../test-helper');
var chai          = require('chai');
var path          = require('path');
var fs            = require('fs-extra');
var assert        = chai.assert;
var should        = chai.should();

chai.use(require('chai-fs'));

describe('mavensmate new-project', function(){

  var project;
  var testClient;

  before(function(done) {
    this.timeout(4000);
    testClient = helper.createClient('atom');
    helper.unlinkEditor();
    helper.putTestProjectInTestWorkspace(testClient, 'new-project-existing');
    helper.setProject(testClient, 'new-project-existing', function(err, proj) {
      project = proj;
      done();
    });
  });

  after(function(done) {
    this.timeout(4000);
    helper.cleanUpTestProject('new-project-existing')
      .then(helper.cleanUpTestProject('new-project'))
      .then(function() {
        done();
      });
  });

  it('should require username and password', function(done) {
    testClient.executeCommand('new-project', {}, function(err, response) {
      should.equal(response, undefined);
      err.should.have.property('error');
      err.error.should.equal('Please specify username, password, and project name');
      done();
    });
  });

  it('should prompt that project directory already exists', function(done) {
    
    this.timeout(5000);

    var payload = {
      name: 'new-project-existing',
      username: 'mm@force.com',
      password: 'force',
      workspace: path.join(helper.baseTestDirectory(),'workspace')
    };
    testClient.executeCommand('new-project', payload, function(err, response) {
      should.equal(response, undefined);
      err.should.have.property('error');
      err.error.should.equal('Directory already exists!');
      done();
    });
  });

  it('should prompt because of bad salesforce creds', function(done) {    
    this.timeout(20000);

    var payload = {
      name: 'new-project-bad-creds',
      username: 'thiswontwork@force.com',
      password: 'thisisabadpassword',
      workspace: path.join(helper.baseTestDirectory(),'workspace')
    };
    testClient.executeCommand('new-project', payload, function(err, response) {
      should.equal(response, undefined);
      err.should.have.property('error');
      err.error.should.contain('INVALID_LOGIN: Invalid username, password, security token; or user locked out');
      done();
    });
  });

  it('should create project in specified workspace', function(done) {
    
    this.timeout(30000);
    
    var payload = {
      name: 'new-project',
      username: process.env.SALESFORCE_USERNAME || 'mm@force.com',
      password: process.env.SALESFORCE_PASSWORD || 'force',
      workspace: path.join(helper.baseTestDirectory(),'workspace'),
      orgType: process.env.SALESFORCE_ORG_TYPE || 'developer',
      package: {
        ApexPage: '*',
        CustomObject: ['Account']
      }
    };

    testClient.executeCommand('new-project', payload, function(err, response) {
      should.equal(err, null);
      response.should.have.property('result');
      response.result.should.equal('Project created successfully');
      assert.isDirectory(path.join(helper.baseTestDirectory(),'workspace', 'new-project'),  'Project directory does not exist');
      assert.isDirectory(path.join(helper.baseTestDirectory(),'workspace', 'new-project', 'config'),  'Project config directory does not exist');
      assert.isDirectory(path.join(helper.baseTestDirectory(),'workspace', 'new-project', 'src'),  'Project src directory does not exist');
      assert.isFile(path.join(helper.baseTestDirectory(),'workspace', 'new-project', 'src', 'package.xml'),  'Project package.xml does not exist');
      fs.existsSync(path.join(helper.baseTestDirectory(),'workspace', 'new-project', 'tmp.zip')).should.equal(false);
      helper.setProject(testClient, 'new-project', function() {
        var project = testClient.getProject();
        project.settings.username.should.equal(process.env.SALESFORCE_USERNAME || 'mm@force.com');
        project.settings.password.should.equal(process.env.SALESFORCE_PASSWORD || 'force');
        project.settings.environment.should.equal('developer');
        done();
      });
    });
  });

});
