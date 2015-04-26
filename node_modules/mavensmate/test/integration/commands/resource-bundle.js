'use strict';

var helper      = require('../../test-helper');
var chai        = require('chai');
var should      = chai.should();
var path        = require('path');
var fs          = require('fs-extra');
var assert      = chai.assert;

chai.use(require('chai-fs'));

describe('mavensmate resource-bundle', function(){

  var project;
  var testClient;

  before(function(done) {
    this.timeout(4000);
    testClient = helper.createClient('atom');
    helper.unlinkEditor();
    helper.putTestProjectInTestWorkspace(testClient, 'resource-bundle');
    helper.setProject(testClient, 'resource-bundle', function(err, proj) {
      project = proj;
      done();
    });
  });

  after(function(done) {
    this.timeout(15000);
    var filesToDelete = [
      path.join(helper.baseTestDirectory(),'workspace', 'resource-bundle', 'src', 'staticresources', 'test_resource_bundle.resource')
    ];
    helper.cleanUpTestData(testClient, filesToDelete)
      .then(function() {
        return helper.cleanUpTestProject('resource-bundle');
      })
      .then(function() {
        done();
      })
      .catch(function(err) {
        done(err);
      });
  });

  it('should create a resource bundle from a local static resource file', function(done) {
    this.timeout(10000);
  
    fs.copySync(
      path.join(helper.baseTestDirectory(), 'fixtures', 'test_resource_bundle.zip'), 
      path.join(helper.baseTestDirectory(), 'workspace', 'resource-bundle', 'src', 'staticresources', 'test_resource_bundle.resource')
    );

    fs.copySync(
      path.join(helper.baseTestDirectory(), 'fixtures', 'test_resource_bundle.resource-meta.xml'), 
      path.join(helper.baseTestDirectory(), 'workspace', 'resource-bundle', 'src', 'staticresources', 'test_resource_bundle.resource-meta.xml')
    );

    var payload = {
      paths : [path.join(helper.baseTestDirectory(), 'workspace', 'resource-bundle', 'src', 'staticresources', 'test_resource_bundle.resource')]
    };

    testClient.executeCommand('new-resource-bundle', payload, function(err, response) {
      // console.log(err);
      // console.log(response);
      should.equal(err, null);
      response.should.have.property('result');
      response.result.should.equal('Resource bundle(s) successfully created');
      assert.isDirectory(path.join(helper.baseTestDirectory(),'workspace', 'resource-bundle', 'resource-bundles', 'test_resource_bundle.resource'),  'Resource bundle directory not created');
      assert.isDirectory(path.join(helper.baseTestDirectory(),'workspace', 'resource-bundle', 'resource-bundles', 'test_resource_bundle.resource', 'css'),  'Resource bundle css directory not created');
      assert.isDirectory(path.join(helper.baseTestDirectory(),'workspace', 'resource-bundle', 'resource-bundles', 'test_resource_bundle.resource', 'js'),  'Resource bundle js directory not created');
      assert.isFile(path.join(helper.baseTestDirectory(),'workspace', 'resource-bundle', 'resource-bundles', 'test_resource_bundle.resource', 'css', 'bar.css'),  'Resource bundle css file not created');
      assert.isFile(path.join(helper.baseTestDirectory(),'workspace', 'resource-bundle', 'resource-bundles', 'test_resource_bundle.resource', 'js', 'foo.js'),  'Resource bundle js file not created');
      done();
    });
  });

  it('should deploy a resource bundle to the server', function(done) {    
    this.timeout(30000);

    var payload = {
      paths :[ path.join(helper.baseTestDirectory(), 'workspace', 'resource-bundle', 'resource-bundles', 'test_resource_bundle.resource') ]
    };

    testClient.executeCommand('deploy-resource-bundle', payload, function(err, response) {
      // console.log(err);
      // console.log(response);
      should.equal(err, null);
      response.should.have.property('result');
      response.result.should.equal('Resource bundle successfully deployed');
      assert.isFile(path.join(helper.baseTestDirectory(),'workspace', 'resource-bundle', 'src', 'staticresources', 'test_resource_bundle.resource'),  'Resource bundle staticresource does not exist');
      done();
    });    
  });

});

