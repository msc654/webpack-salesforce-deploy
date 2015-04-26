'use strict';

var helper      = require('../../test-helper');
var chai        = require('chai');
var should      = chai.should();
var assert      = chai.assert;
var path        = require('path');

chai.use(require('chai-fs'));

describe('mavensmate index-apex', function(){

  var project;
  var testClient;

  before(function(done) {
    this.timeout(4000);
    testClient = helper.createClient('atom');
    helper.unlinkEditor();
    helper.putTestProjectInTestWorkspace(testClient, 'index-apex');
    helper.setProject(testClient, 'index-apex', function(err, proj) {
      project = proj;
      done();
    });
  });

  after(function(done) {
    this.timeout(10000);
    var filesToDelete = [path.join(helper.baseTestDirectory(),'workspace', 'index-apex', 'src', 'classes', 'IndexMySymbolsClass.cls')];
    helper.cleanUpTestData(testClient, filesToDelete)
      .then(function() {
        return helper.cleanUpTestProject('index-apex');
      })
      .then(function() {
        done();
      });
  });

  it('should index project apex symbols', function(done) {    
    this.timeout(40000);

    testClient.executeCommand('index-apex', function(err, response) {
      should.equal(err, null);
      response.should.have.property('result');
      response.result.should.equal('Symbols successfully indexed');
      assert.isDirectory(path.join(helper.baseTestDirectory(),'workspace', 'index-apex', 'config', '.symbols'),  'Symbols directory does not exist');
      done();
    });
  });

  it('should index apex symbols for a specific apex class', function(done) {
    this.timeout(20000);

    helper.createNewMetadata(testClient, 'ApexClass', 'IndexMySymbolsClass')
      .then(function() {
        testClient.executeCommand('index-apex-class', { 'className' : 'IndexMySymbolsClass' }, function(err, response) {
          should.equal(err, null);
          response.should.have.property('result');
          response.result.should.equal('Symbols successfully indexed for IndexMySymbolsClass');
          assert.isDirectory(path.join(helper.baseTestDirectory(),'workspace', 'index-apex', 'config', '.symbols'),  'Symbols directory does not exist');
          assert.isFile(path.join(helper.baseTestDirectory(),'workspace', 'index-apex', 'config', '.symbols', 'IndexMySymbolsClass.json'),  'Symbols file does not exist');
          done();
        });
      })
      .done();
  });

});
