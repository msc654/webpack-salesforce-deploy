'use strict';

var helper          = require('../test-helper');
var chai            = require('chai');
var should          = chai.should();
var fs              = require('fs-extra');
var path            = require('path');
var Package         = require('../../lib/mavensmate/package').Package;
var mavensMateFile  = require('../../lib/mavensmate/file');
var assert          = chai.assert;

chai.use(require('chai-fs'));

describe('mavensmate unit-package', function(){

  var project;
  var testClient;

  before(function(done) {
    this.timeout(4000);
    testClient = helper.createClient('atom');
    helper.putTestProjectInTestWorkspace(testClient, 'package-test');
    helper.setProject(testClient, 'package-test', function(err, proj) {
      project = proj;
      done();
    });
  });

  after(function(done) {
    helper.cleanUpTestProject('package-test')
      .then(function() {
        done();
      });
  });

  it('should create instance from package.xml path', function(done) {
    // write package
    var members = '<types><members>myclass</members><members>myclass2</members><name>ApexClass</name></types><types><members>*</members><name>ApexPage</name></types>';
    var packageXml = '<?xml version="1.0" encoding="UTF-8"?><Package xmlns="http://soap.sforce.com/2006/04/metadata">'+members+'<version>30.0</version></Package>';
    var packagePath = path.join(helper.baseTestDirectory(), 'workspace', 'package-test', 'src', 'package.xml');
    fs.writeFileSync(packagePath, packageXml);

    // deserialize package
    var pkg = new Package({ path: packagePath });
    pkg.init()
      .then(function() {
        pkg.subscription.should.have.property('ApexClass');
        pkg.subscription.should.have.property('ApexPage');
        pkg.subscription.ApexClass.length.should.equal(2);
        pkg.subscription.ApexPage.should.equal('*');
        done();
      })
      .catch(function(e) {
        done(e);
      })
      .done();
  });

  it('should support adding/removing members', function(done) {
    // write package
    var members = '<types><members>myclass</members><members>myclass2</members><name>ApexClass</name></types><types><members>*</members><name>ApexPage</name></types>';
    var packageXml = '<?xml version="1.0" encoding="UTF-8"?><Package xmlns="http://soap.sforce.com/2006/04/metadata">'+members+'<version>30.0</version></Package>';
    var packagePath = path.join(helper.baseTestDirectory(), 'workspace', 'package-test', 'src', 'package.xml');
    fs.writeFileSync(packagePath, packageXml);

    var pkg = new Package({ path: packagePath });
    pkg.init()
      .then(function() {
        pkg.subscription.should.have.property('ApexClass');
        pkg.subscription.should.have.property('ApexPage');
        pkg.subscription.ApexClass.length.should.equal(2);
        pkg.subscription.ApexPage.should.equal('*');
        
        var pkgMetadata = new mavensMateFile.MavensMateFile({ path: '/path/to/src/classes/foo.cls' });
        pkg.subscribe([pkgMetadata]);
        pkg.subscription.ApexClass.length.should.equal(3);  

        pkgMetadata = new mavensMateFile.MavensMateFile({ path: '/path/to/src/classes/myclass.cls' });
        pkg.unsubscribe([pkgMetadata]);
        pkg.subscription.ApexClass.length.should.equal(2);  
        done();      
      })
      .catch(function(e) {
        done(e);
      })
      .done();
  });

  it('should create instance from metadata array', function(done) {
    var files = [];
    files.push(new mavensMateFile.MavensMateFile({ path: '/path/to/src/classes/foo.cls' }));
    files.push(new mavensMateFile.MavensMateFile({ path: '/path/to/src/objects/Account.object' }));
    files.push(new mavensMateFile.MavensMateFile({ path: '/path/to/src/pages/mypage.page' }));
    files.push(new mavensMateFile.MavensMateFile({ path: '/path/to/src/pages/mypage2.page' }));
    files.push(new mavensMateFile.MavensMateFile({ path: '/path/to/src/triggers/mytrigger.trigger' }));
    var pkg = new Package({ files: files });
    pkg.init()
      .then(function() {
        pkg.subscription.should.have.property('ApexClass');
        pkg.subscription.should.have.property('ApexPage');
        pkg.subscription.should.have.property('CustomObject');
        pkg.subscription.ApexClass.length.should.equal(1);
        pkg.subscription.ApexPage.length.should.equal(2);
        pkg.subscription.CustomObject.length.should.equal(1);
        pkg.subscription.ApexTrigger.length.should.equal(1);
        done();      
      })
      .catch(function(e) {
        done(e);
      })
      .done();
  });

  it('should create instance from an array of type names', function(done) {
    var pkg = new Package({ metadataTypeXmlNames: ['ApexClass', 'ApexPage'] });
    pkg.init()
      .then(function() {
        pkg.subscription.should.have.property('ApexClass');
        pkg.subscription.should.have.property('ApexPage');
        pkg.subscription.ApexClass.should.equal('*');
        pkg.subscription.ApexPage.should.equal('*');
        done();      
      })
      .catch(function(e) {
        done(e);
      })
      .done();
  });

  it('should write package instance to the specified path', function(done) {
    var files = [];
    files.push(new mavensMateFile.MavensMateFile({ path: '/path/to/src/classes/foo.cls' }));
    files.push(new mavensMateFile.MavensMateFile({ path: '/path/to/src/objects/Account.object' }));
    files.push(new mavensMateFile.MavensMateFile({ path: '/path/to/src/pages/mypage.page' }));
    files.push(new mavensMateFile.MavensMateFile({ path: '/path/to/src/pages/mypage2.page' }));
    files.push(new mavensMateFile.MavensMateFile({ path: '/path/to/src/triggers/mytrigger.trigger' }));
    var pkg = new Package({ files: files });
    pkg.init()
      .then(function() {
        pkg.path = path.join(helper.baseTestDirectory(),'workspace', 'package-unit-test.xml');
        return pkg.writeFile();
      })
      .then(function() {
        assert.isFile(path.join(helper.baseTestDirectory(),'workspace', 'package-unit-test.xml'),  'Package.xml file not created');
        done();
      })
      .catch(function(e) {
        done(e);
      })
      .done();
  });
});
