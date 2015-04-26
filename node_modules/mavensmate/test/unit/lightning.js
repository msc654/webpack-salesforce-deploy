'use strict';

var helper            = require('../test-helper');
var chai              = require('chai');
var fs                = require('fs-extra');
var path              = require('path');
var LightningService  = require('../../lib/mavensmate/lightning');
var mavensMateFile    = require('../../lib/mavensmate/file');
var assert            = chai.assert;

chai.use(require('chai-fs'));

describe('mavensmate lightning-unit', function(){

  var project;
  var testClient;
  
  before(function(done) {
    this.timeout(8000);
    helper.unlinkEditor();
    testClient = helper.createClient('atom');
    helper.putTestProjectInTestWorkspace(testClient, 'lightning-unit');
    helper.setProject(testClient, 'lightning-unit', function(err, proj) {
      project = proj;
      done();
    });
  });
  
  after(function(done) {
    helper.cleanUpTestProject('lightning-unit')
      .then(function() {
        done();
      });
  });

  it('should create a bundle and bundle items, then delete the bundle item, then the bundle', function (done) {
    this.timeout(20000);
    var ls = new LightningService(project);
    var bundleId;
    var appId;
    var styleId;
    ls.createBundle('unitTestBundle', 'test')
      .then(function(res) {
        bundleId = res.id;
        return ls.createApplication(bundleId);
      })
      .then(function(res) {
        res.success.should.equal(true);
        res.should.have.property('id');
        appId = res.id;
        return ls.createStyle(bundleId);
      })
      .then(function(res) {
        res.success.should.equal(true);
        res.should.have.property('id');
        styleId = res.id;
        return project.indexLightning();
      })
      .then(function() {
        var styleFile = new mavensMateFile.MavensMateFile({ path: path.join(helper.baseTestDirectory(), 'workspace', 'lightning-unit', 'src', 'aura', 'unitTestBundle', 'unitTestBundle.css') });
        return ls.deleteBundleItems([ styleFile ]);
      })
      .then(function(res) {
        res[0].success.should.equal(true);
        res[0].should.have.property('id');
        return ls.deleteBundle(bundleId);
      })
      .then(function(res) {
        res.success.should.equal(true);
        res.should.have.property('id');
        done();
      });
  });
});
