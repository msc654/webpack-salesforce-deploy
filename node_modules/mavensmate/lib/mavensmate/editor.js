'use strict';

var Promise     = require('bluebird');
var _           = require('lodash');
var which       = require('which');
var spawn       = require('child_process').spawn;
var logger      = require('winston');
var util        = require('./util').instance;
var config      = require('./config');
var path        = require('path');
var os          = require('os');
var open        = require('open');
var querystring = require('querystring');

/**
 * Service to handle interaction with the client's editor (sublime, atom, etc.)
 * @param {Client} client
 */
var EditorService = function(client) {
  if (!client.editor || !_.isString(client.editor)) {
    throw new Error('Could not initiate editor service. Client must contain valid editor name');
  }
  this.client = client;
};

/**
 * Maps a given command name to the uri
 * @type {Object}
 */
EditorService.prototype._uriMap = {
  'new-project' : 'project/new',
  'edit-project' : 'project/edit',
  'new-metadata' : 'metadata/new',
  'deploy' : 'deploy/new',
  'test' : 'test/new',
  'run-tests': 'test/new',
  'execute-apex' : 'apex/new',
  'new-lightning-app' : 'lightning/new-app',
  'new-lightning-component' : 'lightning/new-component',
  'new-lightning-event' : 'lightning/new-event',
  'new-lightning-interface' : 'lightning/new-interface'
};

/**
 * Launches the MavensMate UI in either MavensMateWindowServer.app (osx) or the web browser (Linux/Windows) 
 * @param  {String} commandName
 * @return {Nothing}
 */
EditorService.prototype.launchUI = function(commandName, urlParams) {
  var self = this;
  var portNumber = process.env.MAVENSMATE_UI_SERVER_PORT;

  if (!portNumber) {
    throw new Error('MAVENSMATE_UI_SERVER_PORT environment variable not set');
  }

  var url = 'http://localhost:'+portNumber+'/app/'+self._uriMap[commandName];
  if (urlParams) {
    url += '?'+querystring.stringify(urlParams);
  }

  logger.debug('opening url --->');
  logger.debug(url);

  if (os.platform() === 'darwin') {
    var windowServerPath = path.join(util.getAppRoot(), 'bin', 'MavensMateWindowServer.app');  
    var windowServerChildProcess = spawn('open', ['-n', windowServerPath, '--args', '-url', url], {
      detached: true
    });
    windowServerChildProcess.on('close', function (code) {
      if (code === 0) {
        process.exit(0);
      }
    });
  } else {
    // open web browser
    open(url, function() {
      process.exit(0);
    });
  }

  // open('http://localhost:'+portNumber+'/app/'+self._uriMap[commandName], function() {
  //   process.exit(0);
  // });
};

/**
 * Opens the specified URL in the user's browser (should probably be located in util, but oh well)
 * @param  {String} url - url to open in the browser
 */
EditorService.prototype.openUrl = function(url) {
  // var self = this;
  return new Promise(function(resolve, reject) {
    try {
      if (os.platform() === 'darwin') {    
        var browserChildProcess = spawn('open', [url], {
          detached: true
        });

        browserChildProcess.on('close', function (code) {
          if (code === 0) { 
            resolve();
            // TODO: process.exit(0); when running on CLI (client.program === true)
          }
        });
      } else {
        // open web browser
        open(url, function() {
          resolve();
          // process.exit(0);
        });
      }
    } catch(e) {
      reject(e);
    }
  });
};

/**
 * Open a specific path in the editor
 * @param  {String} path - path to open
 * @return {Nothing}      
 */
EditorService.prototype.open = function(path) {
  if (this.client.editor.toLowerCase() === 'atom') {
    try {
      if (which.sync('atom')) {
        var atom = spawn(which.sync('atom'), [ path ]);
        atom.stdout.on('data', function (data) {
          logger.debug('atom STDOUT:');
          logger.debug(data);
        });

        atom.stderr.on('data', function (data) {
          logger.error('Result of path open in atom: ');
          logger.error(data);
        });

        atom.on('close', function (code) {
          logger.debug('atom close: ');
          logger.debug(code);
        });
      }
    } catch(e) {
      logger.debug('Could not open path in Atom: '+e.message+'. Attempting to use config variable to open.');

      var atomExecConfig = config.get('mm_atom_exec_path');
      if (atomExecConfig) {
        try {
          var atom = spawn(atomExecConfig, [ path ]);
          atom.stdout.on('data', function (data) {
            logger.debug('atom STDOUT:');
            logger.debug(data);
          });

          atom.stderr.on('data', function (data) {
            logger.error('Result of path open in atom: ');
            logger.error(data);
          });

          atom.on('close', function (code) {
            logger.debug('atom close: ');
            logger.debug(code);
          });
        } catch(e) {
          logger.debug('Tried to use '+atomExecConfig+ ', however could not open path');
        }
      }
    }
  } else if (this.client.editor.toLowerCase() === 'sublime') {
    try {
      if (which.sync('subl')) {
        var subl = spawn(which.sync('subl'), [ path ]);
        subl.stdout.on('data', function (data) {
          logger.debug('subl STDOUT:');
          logger.debug(data);
        });

        subl.stderr.on('data', function (data) {
          logger.error('Result of path open in sublime: ');
          logger.error(data);
        });

        subl.on('close', function (code) {
          logger.debug('subl close: ');
          logger.debug(code);
        });
      }
    } catch(e) {
      logger.debug('Could not open path in Sublime Text: '+e.message+'. Attempting to use config variable to open.');
      
      var sublConfig;
      if (util.isWindows()) {
        sublConfig = config.get('mm_windows_subl_location');
      } else {
        sublConfig = config.get('mm_subl_location');
      }
      if (sublConfig) {
        try {
          var subl = spawn(sublConfig, [ path ]);
          subl.stdout.on('data', function (data) {
            logger.debug('subl STDOUT:');
            logger.debug(data);
          });

          subl.stderr.on('data', function (data) {
            logger.error('Result of path open in sublime: ');
            logger.error(data);
          });

          subl.on('close', function (code) {
            logger.debug('subl close: ');
            logger.debug(code);
          });
        } catch(e) {
          logger.debug('Tried to use '+sublConfig+ ', however could not open path');
        }
      }
    }
  }
};

module.exports = EditorService;