'use strict';

var helper      = require('../../test-helper');
var chai        = require('chai');
var should      = chai.should();

describe('mavensmate compile-project', function(){

  var project;
  var testClient;

  before(function(done) {
    this.timeout(8000);
    testClient = helper.createClient('atom');
    helper.unlinkEditor();
    helper.putTestProjectInTestWorkspace(testClient, 'compile-project');
    helper.setProject(testClient, 'compile-project', function(err, proj) {
      project = proj;
      done();
    });
  });

  after(function(done) {
    helper.cleanUpTestProject('compile-project')
      .then(function() {
        done();
      });
  });

  it('should compile the project based on package.xml', function(done) {
    this.timeout(40000);
    
    testClient.executeCommand('edit-project', { package: { 'ApexComponent' : '*' } }, function() {
      testClient.executeCommand('compile-project', function(err, response) {
        should.equal(err, null);
        response.should.have.property('result');
        response.result.success.should.equal(true);
        response.result.status.should.equal('Succeeded');
        done();
      });
    }); 
  });

});
