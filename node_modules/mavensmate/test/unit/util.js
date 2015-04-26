'use strict';

var os    = require('os');
var util  = require('../../lib/mavensmate/util').instance;
var sinon = require('sinon');
var path  = require('path');

describe('mavensmate util', function(){

  describe('startsWith', function() {
    it('should return true', function(done) {    
      util.startsWith('foobar', 'foo').should.equal(true);
      done();
    });

    it('should return false', function(done) {    
      util.startsWith('foobar', 'bar').should.equal(false);
      done();  
    });
  });

  describe('platform checks', function() {
    
    var stub;

    beforeEach(function() {
      stub = sinon.stub(os, 'platform');
    });

    afterEach(function() {
      stub.restore();
    });

    describe('isWindows', function() {
      it('should return true', function(done) {    
        stub.returns('win32');
        util.isWindows().should.equal(true);
        done();
      });

      it('should return false', function(done) {    
        stub.returns('darwin');
        util.isWindows().should.equal(false);
        done();
      });
    });

    describe('isLinux', function() {
      it('should return true', function(done) {    
        stub.returns('linux');
        util.isLinux().should.equal(true);
        done();
      });

      it('should return false', function(done) {    
        stub.returns('darwin');
        util.isLinux().should.equal(false);
        done();
      });
    });

    describe('isMac', function() {
      it('should return true', function(done) {    
        stub.returns('darwin');
        util.isMac().should.equal(true);
        done();
      });

      it('should return false', function(done) {    
        stub.returns('win32');
        util.isMac().should.equal(false);
        done();
      });
    });
  });

  describe('getHomeDirectory', function() {
    
    var stub;

    beforeEach(function() {
      stub = sinon.stub(os, 'platform');
    });

    afterEach(function() {
      stub.restore();
    });

    it('should return mac home directory', function(done) {    
      stub.returns('darwin');
      util.getHomeDirectory();
      done();
    });

    it('should return linux home directory', function(done) {    
      stub.returns('linux');
      util.getHomeDirectory();
      done();
    });

    it('should return windows home directory', function(done) {    
      stub.returns('win32');
      util.getHomeDirectory();
      done();
    });
    
  });

  describe('getAbsolutePaths', function() {
    it('should return absolute paths', function(done) {    
      var paths = [
        'relative/path/to/something',
        '/absolute/path/to/something'
      ];
      var ps = util.getAbsolutePaths(paths);
      ps[0][0].should.equal(path.sep);
      ps[1][0].should.equal(path.sep);
      done();
    }); 
  });

});


