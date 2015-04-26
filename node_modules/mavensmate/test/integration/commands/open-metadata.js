'use strict';

var helper      = require('../../test-helper');
var chai        = require('chai');
var should      = chai.should();
var path        = require('path');

describe('mavensmate open-metadata', function(){

  var project;
  var testClient;

  before(function(done) {
    this.timeout(4000);
    testClient = helper.createClient('atom');
    helper.unlinkEditor();
    helper.putTestProjectInTestWorkspace(testClient, 'open-metadata');
    helper.setProject(testClient, 'open-metadata', function(err, proj) {
      project = proj;
      done();
    });
  });

  after(function(done) {
    this.timeout(15000);
    var filesToDelete = [
      path.join(helper.baseTestDirectory(),'workspace', 'open-metadata', 'src', 'pages', 'OpenMetadataPage.page')
    ];
    helper.cleanUpTestData(testClient, filesToDelete)
      .then(function() {
        return helper.cleanUpTestProject('open-metadata');
      })
      .then(function() {
        done();
      });
  });

  it('should return the Visualforce page preview url', function(done) {
    this.timeout(20000);      

    helper.createNewMetadata(testClient, 'ApexPage', 'OpenMetadataPage', 'ApexPage.page', { api_name : 'OpenMetadataPage' } )
      .then(function() {          
        var payload = {
          paths : [ path.join(helper.baseTestDirectory(),'workspace', 'open-metadata', 'src', 'pages', 'OpenMetadataPage.page') ],
          preview: true
        };
        testClient.executeCommand('open-metadata', payload, function(err, response) {
          should.equal(err, null);
          response.should.have.property('result');
          response.result.should.have.property('OpenMetadataPage.page');
          response.result['OpenMetadataPage.page'].indexOf('secur/frontdoor.jsp?sid=').should.be.at.least(0);
          done();
        });
      });
  });
});