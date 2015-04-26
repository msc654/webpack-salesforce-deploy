'use strict';

var fs                = require('fs-extra');
var path              = require('path');
var helper            = require('../test-helper');
var mavensMateFile    = require('../../lib/mavensmate/file');
var chai              = require('chai');
var should            = chai.should();

describe('mavensmate mavensmate-file', function(){

  var project;
  var testClient;

  before(function(done) {
    this.timeout(10000);
    testClient = helper.createClient('atom');
    helper.putTestProjectInTestWorkspace(testClient, 'file-test');
    helper.setProject(testClient, 'file-test', function(err, proj) {
      project = proj;
      done();
    });
  });

  after(function(done) {
    helper.cleanUpTestProject('file-test')
      .then(function() {
        done();
      });
  });

  it('should create new File instance of type ApexClass', function(done) {
    var apexClassPath = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'classes', 'foo.cls');
    fs.outputFileSync(apexClassPath, '');
    var file = new mavensMateFile.MavensMateFile({ project: project, path: apexClassPath });
    file.type.xmlName.should.equal('ApexClass');
    done();
  });

  it('should create new File instance of type ApexPage', function(done) {
    var apexPagePath = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'pages', 'foo.page');
    fs.outputFileSync(apexPagePath, '');

    var file = new mavensMateFile.MavensMateFile({ project: project, path: apexPagePath });
    file.type.xmlName.should.equal('ApexPage');
    done();
  });

  it('should create new File instance of type CustomObject', function(done) {  
    var customObjectPath = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'objects', 'Account.object');
    fs.outputFileSync(customObjectPath, '');

    var file = new mavensMateFile.MavensMateFile({ project: project, path: customObjectPath });
    file.type.xmlName.should.equal('CustomObject');
    done();
  });

  it('should create new File instance of type EmailTemplate', function(done) {  
    var emailTemplatePath = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'email', 'myfolder', 'myEmail.email');
    fs.outputFileSync(emailTemplatePath, '');

    var file = new mavensMateFile.MavensMateFile({ project: project, path: emailTemplatePath });
    file.type.xmlName.should.equal('EmailTemplate');
    fs.removeSync(emailTemplatePath);
    done();
  });

  it('should create new File instance of type Document', function(done) {  
    var documentPath = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'documents', 'myfolder', 'foo.jpg');
    fs.outputFileSync(documentPath, '');

    var file = new mavensMateFile.MavensMateFile({ project: project, path: documentPath });
    file.type.xmlName.should.equal('Document');
    fs.removeSync(documentPath);
    done();
  });

  it('should create new File instance of type AuraDefinitionBundle > STYLE', function(done) {  
    var itemPath = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'aura', 'foo', 'foo.css');
    fs.ensureFileSync(itemPath, '');

    var file = new mavensMateFile.MavensMateFile({ project: project, path: itemPath });
    file.type.xmlName.should.equal('AuraDefinitionBundle');
    file.lightningType.should.equal('STYLE');
    done();
  });

  it('should create new File instance of type AuraDefinitionBundle > APPLICATION', function(done) {  
    var itemPath = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'aura', 'foo', 'foo.app');
    fs.ensureFileSync(itemPath, '');

    var file = new mavensMateFile.MavensMateFile({ project: project, path: itemPath });
    file.type.xmlName.should.equal('AuraDefinitionBundle');
    file.lightningType.should.equal('APPLICATION');
    done();
  });

  it('should create new File instance of type AuraDefinitionBundle > DOCUMENTATION', function(done) {  
    var itemPath = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'aura', 'foo', 'foo.auradoc');
    fs.ensureFileSync(itemPath, '');

    var file = new mavensMateFile.MavensMateFile({ project: project, path: itemPath });
    file.type.xmlName.should.equal('AuraDefinitionBundle');
    file.lightningType.should.equal('DOCUMENTATION');
    done();
  });

  it('should create new File instance of type AuraDefinitionBundle > COMPONENT', function(done) {  
    var itemPath = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'aura', 'foo', 'foo.cmp');
    fs.ensureFileSync(itemPath, '');

    var file = new mavensMateFile.MavensMateFile({ project: project, path: itemPath });
    file.type.xmlName.should.equal('AuraDefinitionBundle');
    file.lightningType.should.equal('COMPONENT');
    done();
  });

  it('should create new File instance of type AuraDefinitionBundle > EVENT', function(done) {  
    var itemPath = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'aura', 'foo', 'foo.evt');
    fs.ensureFileSync(itemPath, '');

    var file = new mavensMateFile.MavensMateFile({ project: project, path: itemPath });
    file.type.xmlName.should.equal('AuraDefinitionBundle');
    file.lightningType.should.equal('EVENT');
    done();
  });

  it('should create new File instance of type AuraDefinitionBundle > INTERFACE', function(done) {  
    var itemPath = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'aura', 'foo', 'foo.intf');
    fs.ensureFileSync(itemPath, '');

    var file = new mavensMateFile.MavensMateFile({ project: project, path: itemPath });
    file.type.xmlName.should.equal('AuraDefinitionBundle');
    file.lightningType.should.equal('INTERFACE');
    done();
  });

  it('should create new File instance of type AuraDefinitionBundle > CONTROLLER', function(done) {  
    var itemPath = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'aura', 'foo', 'fooController.js');
    fs.ensureFileSync(itemPath, '');

    var file = new mavensMateFile.MavensMateFile({ project: project, path: itemPath });
    file.type.xmlName.should.equal('AuraDefinitionBundle');
    file.lightningType.should.equal('CONTROLLER');
    file.lightningBaseName.should.equal('foo');
    done();
  });

  it('should create new File instance of type AuraDefinitionBundle > HELPER', function(done) {  
    var itemPath = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'aura', 'foo', 'fooHelper.js');
    fs.ensureFileSync(itemPath, '');

    var file = new mavensMateFile.MavensMateFile({ project: project, path: itemPath });
    file.type.xmlName.should.equal('AuraDefinitionBundle');
    file.lightningType.should.equal('HELPER');
    file.lightningBaseName.should.equal('foo');
    done();
  });

  it('should create new File instance of type AuraDefinitionBundle > RENDERER', function(done) {  
    var itemPath = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'aura', 'foo', 'fooRenderer.js');
    fs.ensureFileSync(itemPath, '');

    var file = new mavensMateFile.MavensMateFile({ project: project, path: itemPath });
    file.type.xmlName.should.equal('AuraDefinitionBundle');
    file.lightningType.should.equal('RENDERER');
    file.lightningBaseName.should.equal('foo');
    done();
  });

  it('should create new File instances from directory of type ApexClass', function(done) {
    var apexClassPath = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'classes', 'foo.cls');
    var apexClassPath2 = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'classes', 'foo2.cls');
    fs.outputFileSync(apexClassPath, '');
    fs.outputFileSync(apexClassPath2, '');

    project.packageXml.subscribe([
      new mavensMateFile.MavensMateFile({ project: project, path: apexClassPath }),
      new mavensMateFile.MavensMateFile({ project: project, path: apexClassPath2 })
    ]);

    var apexClassesPath = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'classes');
    
    var apexClassPathFile = new mavensMateFile.MavensMateFile({ project: project, path: apexClassesPath });
    apexClassPathFile.type.xmlName.should.equal('ApexClass');
    apexClassPathFile.localMembers.length.should.equal(2);
    done();
  });

  it('should create new File instances from directory of type Document', function(done) {
    var documentPath = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'documents');
    fs.ensureDirSync(documentPath);
    fs.ensureDirSync(path.join(documentPath, 'myfolder'));

    var docPath1 = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'documents', 'myfolder', 'foo.html');
    var docPath2 = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'documents', 'myfolder', 'foo.txt');
    fs.outputFileSync(docPath1, '');
    fs.outputFileSync(docPath2, '');

    project.packageXml.subscribe([
      new mavensMateFile.MavensMateFile({ project: project, path: docPath1 }),
      new mavensMateFile.MavensMateFile({ project: project, path: docPath2 })
    ]);

    var documentPathFile = new mavensMateFile.MavensMateFile({ project: project, path: documentPath });
    documentPathFile.type.xmlName.should.equal('Document');
    documentPathFile.localMembers.length.should.equal(3);
    done();
  });

  it('should create new File instances from directory of type EmailTemplate', function(done) {
    var email1 = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'email', 'myfolder', 'foo.email');
    var email2 = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'email', 'myfolder', 'foo2.email');
    fs.outputFileSync(email1, '');
    fs.outputFileSync(email2, '');

    project.packageXml.subscribe([
      new mavensMateFile.MavensMateFile({ project: project, path: email1 }),
      new mavensMateFile.MavensMateFile({ project: project, path: email2 })
    ]);

    var emailPath = path.join(helper.baseTestDirectory(), 'workspace', 'file-test', 'src', 'email');
    fs.ensureDirSync(emailPath);

    var emailPathFile = new mavensMateFile.MavensMateFile({ project: project, path: emailPath });
    emailPathFile.type.xmlName.should.equal('EmailTemplate');
    emailPathFile.localMembers.length.should.equal(3);
    done();
  });


});
