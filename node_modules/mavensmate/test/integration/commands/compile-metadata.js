'use strict';

var helper      = require('../../test-helper');
var chai        = require('chai');
var should      = chai.should();
var path        = require('path');
var fs          = require('fs-extra');

describe('mavensmate compile-metadata', function(){

  var project;
  var testClient;

  before(function(done) {
    this.timeout(4000);
    /*jshint camelcase: false */
    process.env.mm_compile_check_conflicts = false;
    /*jshint camelcase: true */
    testClient = helper.createClient('atom');
    helper.unlinkEditor();
    helper.putTestProjectInTestWorkspace(testClient, 'compile-metadata');
    helper.setProject(testClient, 'compile-metadata', function(err, proj) {
      project = proj;
      done();
    });
  });

  after(function(done) {
    this.timeout(30000);
    var filesToDelete = [
      path.join(helper.baseTestDirectory(),'workspace', 'compile-metadata', 'src', 'classes', 'CompileMetadataClass.cls'),
      path.join(helper.baseTestDirectory(),'workspace', 'compile-metadata', 'src', 'classes', 'CompileMetadataToolingFailClass.cls'),
      path.join(helper.baseTestDirectory(),'workspace', 'compile-metadata', 'src', 'classes', 'CompileMetadataToolingClass.cls'),
      path.join(helper.baseTestDirectory(),'workspace', 'compile-metadata', 'src', 'classes', 'ConflictCheckClass.cls')
    ];

    testClient.executeCommand('edit-project', { package: { ApexClass: '*' } }, function(err, response) {
      should.equal(err, null);
      should.not.equal(response, null);
      helper.cleanUpTestData(testClient, filesToDelete)
        .then(function() {
          return helper.cleanUpTestProject('compile-metadata');
        })
        .then(function() {
          /*jshint camelcase: false */
          process.env.mm_compile_check_conflicts = false;
          /*jshint camelcase: true */
          done();
        })
        .catch(function(err) {
          done(err);
        });
    });
  });

  it('should compile an apex class successfully via the tooling api', function(done) {
    this.timeout(20000);      

    helper.createNewMetadata(testClient, 'ApexClass', 'CompileMetadataToolingClass')
      .then(function() {
        var apexClassPath = path.join(helper.baseTestDirectory(),'workspace', 'compile-metadata', 'src', 'classes', 'CompileMetadataToolingClass.cls');
        var payload = {
          paths : [ apexClassPath ]
        };
        testClient.executeCommand('compile-metadata', payload, function(err, response) {
          should.equal(err, null);
          response.should.have.property('result');
          response.result.success.should.equal(true);
          response.result.details.componentSuccesses.length.should.equal(1);
          response.result.details.componentSuccesses[0].State.should.equal('Completed');
          done();
        });
      })
      .done();
  });

  it('should check for conflicts on the server', function(done) {
    /*jshint camelcase: false */
    this.timeout(20000);   
    process.env.mm_compile_check_conflicts = true;
    helper.createNewMetadata(testClient, 'ApexClass', 'ConflictCheckClass')
      .then(function() {
        testClient.getProject().updateLocalStore({
            'createdById': '005o0000000TB1iAAG',
            'createdByName': 'Joseph Ferraro',
            'createdDate': '2014-08-18T16:09:51.000Z',
            'fileName': 'unpackaged/classes/ConflictCheckClass.cls',
            'fullName': 'ConflictCheckClass',
            'id': '01po0000001iVdXAAU',
            'lastModifiedById': '005o0000000TB1iAAG',
            'lastModifiedByName': 'Joseph Ferraro',
            'lastModifiedDate': '2012-08-18T16:09:51.000Z',
            'manageableState': 'unmanaged',
            'namespacePrefix': 'mm2',
            'type': 'ApexClass',
            'mmState': 'clean'
          })
          .then(function() {
            var payload = {
              paths : [ path.join(testClient.getProject().path, 'src', 'classes', 'ConflictCheckClass.cls') ]
            };
            testClient.executeCommand('compile-metadata', payload, function(err, response) {
              should.equal(err, null);
              response.should.have.property('result');
              response.result.success.should.equal(false);
              response.result.details.componentSuccesses.length.should.equal(0);
              response.result.details.conflicts.should.have.property('ConflictCheckClass.cls');
              process.env.mm_compile_check_conflicts = false;
              done();
            });
          });
      });
      /*jshint camelcase: true */
  });

  it('should unsuccessfully attempt to compile an apex class via the tooling api', function(done) {
    this.timeout(20000);      

    helper.createNewMetadata(testClient, 'ApexClass', 'CompileMetadataToolingFailClass')
      .then(function() {
        var apexClassPath = path.join(helper.baseTestDirectory(),'workspace', 'compile-metadata', 'src', 'classes', 'CompileMetadataToolingFailClass.cls');
        var payload = {
          paths : [ apexClassPath ]
        };

        fs.outputFileSync(apexClassPath, 'public class CompileMetadataToolingFailClass { this will not work }');

        testClient.executeCommand('compile-metadata', payload, function(err, response) {  
          should.equal(err, null);
          response.should.have.property('result');
          response.result.success.should.equal(false);
          response.result.details.componentFailures.length.should.equal(1);
          response.result.details.componentFailures[0].should.have.property('DeployDetails');
          response.result.details.componentFailures[0].DeployDetails.componentFailures[0].success.should.equal(false);
          response.result.details.componentFailures[0].DeployDetails.componentFailures[0].lineNumber.should.equal(1);
          response.result.details.componentFailures[0].DeployDetails.componentFailures[0].columnNumber.should.equal(-1);
          response.result.details.componentFailures[0].DeployDetails.componentFailures[0].problemType.should.equal('Error');
          response.result.details.componentFailures[0].DeployDetails.componentFailures[0].fileName.should.equal('CompileMetadataToolingFailClass');
          done();
        });
      })
      .done();
  });

  it('should compile a meta.xml file via the metadata api', function(done) {
    this.timeout(20000);      
    
    helper.createNewMetadata(testClient, 'ApexClass', 'CompileMetadataClass')
      .then(function() {
        var metaFileLocation = path.join(helper.baseTestDirectory(), 'workspace', 'compile-metadata', 'src', 'classes', 'CompileMetadataClass.cls-meta.xml');
        var payload = {
          paths : [metaFileLocation]
        };
        testClient.executeCommand('compile-metadata', payload, function(err, response) {
          should.equal(err, null);
          response.should.have.property('result');
          response.result.success.should.equal(true);
          done();
        });
      })
      .done();
  });

  it('should compile an object file via the metadata api', function(done) {
    this.timeout(20000);      

    testClient.executeCommand('edit-project', { package: { CustomObject: 'Account' } }, function(err, response) {
      should.equal(err, null);
      should.not.equal(response, null);

      var accountPath = path.join(testClient.getProject().path, 'src', 'objects', 'Account.object');
      fs.existsSync(accountPath).should.equal(true);
      var payload = {
        paths : [accountPath]
      };
      testClient.executeCommand('compile-metadata', payload, function(err, response) {
        should.equal(err, null);
        response.should.have.property('result');
        response.result.success.should.equal(true);
        done();
      });
    });
  });
});