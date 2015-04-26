'use strict';

var ProjectController  = require('../../../lib/mavensmate/ui/controllers/project');
var sinon = require('sinon');

describe('mavensmate ProjectController', function(){

  describe('views', function() {
    
    var ctrl;

    beforeEach(function() {
      ctrl = new ProjectController({
        app : {
          get: function() {
            return null;
          }
        }
      });
    });

    it('should render project/new.html', function(done) {    
      var req,res,spy;
      req = res = {};
      spy = res.render = sinon.spy();

      ctrl.new(req, res);
      spy.calledOnce.should.equal(true);
      done();
    });

    it('should render project/edit.html', function(done) {    
      var req,res,spy;
      req = res = {};
      spy = res.render = sinon.spy();

      ctrl.new(req, res);
      spy.calledOnce.should.equal(true);
      done();
    });  
  });

});


