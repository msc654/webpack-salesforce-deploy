'use strict';

var assert          = require('assert');
var sinon           = require('sinon');
var sinonAsPromised = require('sinon-as-promised');
var util            = require('../../../../lib/mavensmate/util').instance;
var mavensmate      = require('../../../../lib/mavensmate');
var _               = require('lodash');

sinonAsPromised(require('bluebird'));

describe('mavensmate compile-metadata-cli', function(){

  var program;
  var cliClient;
  var executeCommandStub;
  var getPayloadStub;

  before(function(done) {
    delete require.cache[require.resolve('commander')];
    program = require('commander');

    program
      .option('-v --verbose', 'Output logging statements')
      .option('-h --headless', 'Runs in headless (non-interactive terminal) mode. You may wish to use this flag when calling this executable from a text editor or IDE client.')
      .option('-e --editor [name]', 'Specifies the plugin client (sublime, atom)') // no default set
      .option('-p --port [number]', 'UI server port number') // (for sublime text)
      .parse(process.argv, true); // parse top-level args, defer subcommand

    cliClient = mavensmate.createClient({
      editor: program.editor || 'atom',
      headless: true,
      verbose: false,
      program: program
    });

    require('../../../../lib/mavensmate/loader')(cliClient);  
    done();
  });

  beforeEach(function() {
    executeCommandStub = sinon.stub(cliClient, 'executeCommand');
    getPayloadStub = sinon.stub(util, 'getPayload').resolves({ foo : 'bar' });
  });

  afterEach(function() {
    executeCommandStub.restore();
    getPayloadStub.restore();
  });

  it('should accept a metadata path', function(done) {        
    cliClient.program._events['compile-metadata'](['/path/to/something']);
    
    executeCommandStub.calledOnce.should.equal(true);
    assert(executeCommandStub.calledWith('compile-metadata', { paths : [ '/path/to/something' ] }));

    done();
  });

  it('should accept stdin', function(done) {
    cliClient.program._events['compile-metadata']();
    
    getPayloadStub().then(function() {
      executeCommandStub.calledOnce.should.equal(true);
      assert(executeCommandStub.calledWith('compile-metadata', { foo : 'bar' }));
      done();
    });
  });
});