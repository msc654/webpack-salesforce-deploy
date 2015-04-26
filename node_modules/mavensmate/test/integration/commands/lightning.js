'use strict';

var helper      = require('../../test-helper');
var chai        = require('chai');
var should      = chai.should();
var path        = require('path');
var assert      = chai.assert;

chai.use(require('chai-fs'));

describe('mavensmate lightning', function(){

  var project;
  var testClient;

  before(function(done) {
    this.timeout(4000);
    testClient = helper.createClient('atom');
    helper.unlinkEditor();
    helper.putTestProjectInTestWorkspace(testClient, 'lightning');
    helper.setProject(testClient, 'lightning', function(err, proj) {
      project = proj;
      project.indexLightning()
        .then(function() {
          done();
        })
        .catch(function(err) {
          done(err);
        });
    });
  });

  after(function(done) {
    this.timeout(20000);
    var lightningBundlesToDelete = [
      path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmunittestfoo'),
      path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmcompunittestfoo'),
      path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmunittestevent'),
      path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmunittestinterface')
    ];

    helper.cleanUpTestData(testClient, lightningBundlesToDelete)
      .then(function() {
        return helper.cleanUpTestProject('lightning');
      })
      .then(function() {
        done();
      })
      .catch(function(err) {
        helper.cleanUpTestProject('lightning')
          .then(function() {
            done(err);
          });
        done(err);
      });
  });

  it('should create a new lightning app', function(done) {
    this.timeout(10000);      
    
    var payload = {
      apiName : 'mmunittestfoo',
      description : 'something_fun',
      createController: true,
      createHelper: true,
      createStyle: true,
      createDocumentation: true,
      createRenderer: true
    };
    testClient.executeCommand('new-lightning-app', payload, function(err, response) {
      should.equal(err, null);
      response.should.have.property('result');
      response.result.should.equal('Lightning app created successfully');
      assert.isDirectory(path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmunittestfoo'),  'Lightning bundle not created');
      assert.isFile(path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmunittestfoo', 'mmunittestfoo.app'),  'Lightning app not created');
      assert.isFile(path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmunittestfoo', 'mmunittestfoo.auradoc'),  'Lightning doc not created');
      assert.isFile(path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmunittestfoo', 'mmunittestfoo.css'),  'Lightning css not created');
      assert.isFile(path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmunittestfoo', 'mmunittestfooController.js'),  'Lightning controller not created');
      assert.isFile(path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmunittestfoo', 'mmunittestfooHelper.js'),  'Lightning helper not created');
      assert.isFile(path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmunittestfoo', 'mmunittestfooRenderer.js'),  'Lightning renderer not created');
      testClient.getProject().packageXml.subscription.should.have.property('AuraDefinitionBundle');
      testClient.getProject().packageXml.subscription.AuraDefinitionBundle.length.should.equal(1);
      testClient.getProject().packageXml.subscription.AuraDefinitionBundle[0].should.equal('mmunittestfoo');
      done();
    });    
  });

  it('should create a new lightning component', function(done) {
    this.timeout(10000);      
    
    var payload = {
      apiName : 'mmcompunittestfoo',
      description : 'something_fun',
      createController: true,
      createHelper: true,
      createStyle: true,
      createDocumentation: true,
      createRenderer: true
    };
    testClient.executeCommand('new-lightning-component', payload, function(err, response) {
      should.equal(err, null);
      response.should.have.property('result');
      response.result.should.equal('Lightning component created successfully');
      assert.isDirectory(path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmcompunittestfoo'),  'Lightning bundle not created');
      assert.isFile(path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmcompunittestfoo', 'mmcompunittestfoo.cmp'),  'Lightning component not created');
      assert.isFile(path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmcompunittestfoo', 'mmcompunittestfoo.auradoc'),  'Lightning doc not created');
      assert.isFile(path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmcompunittestfoo', 'mmcompunittestfoo.css'),  'Lightning css not created');
      assert.isFile(path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmcompunittestfoo', 'mmcompunittestfooController.js'),  'Lightning controller not created');
      assert.isFile(path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmcompunittestfoo', 'mmcompunittestfooHelper.js'),  'Lightning helper not created');
      assert.isFile(path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmcompunittestfoo', 'mmcompunittestfooRenderer.js'),  'Lightning renderer not created');
      done();
    }); 
  });

  it('should create a new lightning interface', function(done) {
    this.timeout(10000);      
    
    var payload = {
      apiName : 'mmunittestinterface',
      description : 'something_fun'
    };
    testClient.executeCommand('new-lightning-interface', payload, function(err, response) {
      should.equal(err, null);
      response.should.have.property('result');
      response.result.should.equal('Lightning interface created successfully');
      assert.isDirectory(path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmunittestinterface'),  'Lightning bundle not created');
      assert.isFile(path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmunittestinterface', 'mmunittestinterface.intf'),  'Lightning interface not created');
      done();
    }); 
  });

  it('should create a lightning event', function(done) {
    this.timeout(10000);      
    
    var payload = {
      apiName : 'mmunittestevent',
      description : 'something_fun'
    };
    testClient.executeCommand('new-lightning-event', payload, function(err, response) {
      should.equal(err, null);
      response.should.have.property('result');
      response.result.should.equal('Lightning event created successfully');
      assert.isDirectory(path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmunittestevent'),  'Lightning bundle not created');
      assert.isFile(path.join(helper.baseTestDirectory(),'workspace', 'lightning', 'src', 'aura', 'mmunittestevent', 'mmunittestevent.evt'),  'Lightning event not created');
      done();
    }); 
  });

});

