'use strict';

var helper      = require('../../test-helper');
var chai        = require('chai');
var should      = chai.should();
var path        = require('path');
var fs          = require('fs-extra');

describe('mavensmate run-tests', function(){

  var project;
  var testClient;

  before(function(done) {
    this.timeout(4000);
    helper.unlinkEditor();
    testClient = helper.createClient('atom');
    helper.putTestProjectInTestWorkspace(testClient, 'run-tests');
    helper.setProject(testClient, 'run-tests', function(err, proj) {
      project = proj;
      var loggingConfig = {
        'levels': {
          'Workflow': 'INFO', 
          'Callout': 'INFO', 
          'System': 'DEBUG', 
          'Database': 'INFO', 
          'ApexCode': 'DEBUG', 
          'Validation': 'INFO', 
          'Visualforce': 'DEBUG'
        }, 
        /*jshint camelcase: false */
        'users': [
          project.sfdcClient.conn.userInfo.user_id
        ], 
        /*jshint camelcase: true */
        'expiration': 480
      };
      fs.writeJsonSync(path.join(helper.baseTestDirectory(), 'workspace', 'run-tests', 'config', '.debug'), loggingConfig);
      testClient.executeCommand('start-logging', function() {
        done();
      });
    });
  });

  after(function(done) {
    this.timeout(10000);
    var filesToDelete = [
      path.join(helper.baseTestDirectory(),'workspace', 'run-tests', 'src', 'classes', 'RunTestsApexClass.cls'),
      path.join(helper.baseTestDirectory(),'workspace', 'run-tests', 'src', 'classes', 'CoverMe.cls')
    ];
    helper.cleanUpTestData(testClient, filesToDelete)
      .then(function() {
        testClient.executeCommand('stop-logging', function() {
          helper.cleanUpTestProject('run-tests')
            .then(function() {
              done();
            });
        });  
      });
  });

  it('should run tests', function(done) {
    
    this.timeout(40000);
      
    // create test class
    // run tests
    // delete test class

    helper.getNewMetadataPayload('ApexClass', 'RunTestsApexClass', 'UnitTestApexClass.cls')
      .then(function(payload) {
        testClient.executeCommand('new-metadata', payload, function() {
          
          helper.getNewMetadataPayload('ApexClass', 'CoverMe', 'ApexClass.cls')
            .then(function(payload) {
              
              testClient.executeCommand('new-metadata', payload, function() {
                
                var coverMePath = path.join(helper.baseTestDirectory(),'workspace', 'run-tests', 'src', 'classes', 'CoverMe.cls');
                fs.outputFileSync(coverMePath, 'public class CoverMe { public static Boolean doSomething() { return true; } }');

                var testClassPath = path.join(helper.baseTestDirectory(),'workspace', 'run-tests', 'src', 'classes', 'RunTestsApexClass.cls');
                fs.outputFileSync(testClassPath, '@IsTest public class RunTestsApexClass { @IsTest public static void myTest() { System.assert(CoverMe.doSomething() == true); } }');

                var compilePayload = {
                  paths: [ coverMePath, testClassPath ]
                };
                
                testClient.executeCommand('compile-metadata', compilePayload, function() {
                  var testPayload = {
                    classes: [ 'RunTestsApexClass.cls' ]
                  };

                  testClient.executeCommand('run-tests', testPayload, function(err, response) {
                    should.equal(err, null);
                    response.should.have.property('result');
                    response.result.should.have.property('testResults');
                    response.result.should.have.property('coverageResults');
                    response.result.testResults.should.have.property('RunTestsApexClass');
                    response.result.testResults.RunTestsApexClass.Status.should.equal('Completed');
                    response.result.testResults.RunTestsApexClass.results[0].Outcome.should.equal('Pass');
                    response.result.testResults.RunTestsApexClass.results[0].MethodName.should.equal('myTest');
                    response.result.coverageResults.should.have.property('classes');
                    response.result.coverageResults.should.have.property('triggers');
                    response.result.coverageResults.classes.CoverMe.coveredLines.length.should.equal(1);
                    response.result.coverageResults.classes.CoverMe.coveredLines[0].should.equal(1);
                    response.result.coverageResults.classes.CoverMe.percentCovered.should.equal(100);
                    done(); 
                  });                
                });

              });
            });
        });
      })
      .done();
  });

  describe('coverage', function(){
    it('should get coverage for a specific class', function(done) {
      this.timeout(20000);
      var coverageClasses = [path.join(helper.baseTestDirectory(),'workspace', 'run-tests', 'src', 'classes', 'CoverMe.cls')];  
      testClient.executeCommand('get-coverage', { paths: coverageClasses  }, function(err, response) {
        should.equal(err, null);
        response.should.have.property('result');
        response.result.should.have.property('CoverMe.cls');
        response.result['CoverMe.cls'].coveredLines.length.should.equal(1);
        response.result['CoverMe.cls'].coveredLines[0].should.equal(1);
        response.result['CoverMe.cls'].totalLines.should.equal(1);
        response.result['CoverMe.cls'].percentCovered.should.equal(100);
        done();
      });
    });

    it('should get org-wide test coverage', function(done) {
      this.timeout(20000);
      testClient.executeCommand('get-coverage', { global: true  }, function(err, response) {
        should.equal(err, null);
        response.should.have.property('result');
        response.result.should.be.a('number');
        done();
      });
    });
  });
});