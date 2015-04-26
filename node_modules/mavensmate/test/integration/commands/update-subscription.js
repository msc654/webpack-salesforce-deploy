'use strict';

var helper      = require('../../test-helper');
var chai        = require('chai');
var should      = chai.should();

describe('mavensmate update-subscription', function() {

  var project;
  var testClient;
 
  before(function(done) {
    this.timeout(8000);
    helper.unlinkEditor();
    testClient = helper.createClient('atom');
    helper.putTestProjectInTestWorkspace(testClient, 'update-subscription');
    helper.setProject(testClient, 'update-subscription', function(err, proj) {
      project = proj;
      done();
    });
  });
  
  after(function(done) {
    helper.cleanUpTestProject('update-subscription')
      .then(function() {
        done();
      });
  });

  it('should update the project subscription', function(done) {
    this.timeout(10000);  

    testClient.executeCommand('update-subscription', { subscription: ['ApexClass'] }, function(err, response) {
      should.equal(err, null);
      response.should.have.property('result');
      response.result.should.equal('Subscription updated successfully!');
      project.getSubscription().length.should.equal(1);
      project.getSubscription()[0].should.equal('ApexClass');
      done();
    });
  });
});
