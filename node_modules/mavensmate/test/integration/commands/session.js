'use strict';

var helper      = require('../../test-helper');
var chai        = require('chai');
var should      = chai.should();

chai.use(require('chai-fs'));

describe('mavensmate session', function() {

  var testClient;

  before(function(done) {
    this.timeout(4000);
    testClient = helper.createClient('atom');
    helper.unlinkEditor();
    done();
  });

  it('should initiate new salesforce session', function(done) {
    this.timeout(20000);      

    var payload = {
      username: process.env.SALESFORCE_USERNAME || 'mm@force.com',
      password: process.env.SALESFORCE_PASSWORD || 'force',
      orgType: process.env.SALESFORCE_ORG_TYPE || 'developer',
      subscription: ['ApexClass']
    };

    testClient.executeCommand('session', payload, function(err, response) {
      should.equal(err, null);
      response.should.have.property('result');
      response.result.should.have.property('sid');
      response.result.should.have.property('urls');
      response.result.should.have.property('metadataTypes');
      response.result.should.have.property('index');
      done();
    });
  });

  it('should fail to initiate new salesforce session', function(done) {
    this.timeout(20000);      

    var payload = {
      username: 'thiswontwork@foo.com',
      password: 'barbar',
      orgType: 'developer'
    };

    testClient.executeCommand('session', payload, function(err, response) {
      should.not.equal(err, null);
      err.should.have.property('result');
      err.should.have.property('error');
      err.result.should.equal('Could not create new Salesforce session');
      err.error.should.equal('Could not log in to Salesforce.com: Error: INVALID_LOGIN: Invalid username, password, security token; or user locked out.');
      done();
    });
  });
});

