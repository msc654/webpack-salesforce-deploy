'use strict';

var Promise       = require('bluebird');
var _             = require('lodash');
var fs            = require('fs-extra');
var path          = require('path');
var up            = require('underscore-plus');
var inherits      = require('inherits');
var events        = require('events');
var config        = require('./config');
var Project       = require('./project');
var util          = require('./util').instance;
var UIServer      = require('./ui/server');
var logger;

// TODO: convert getters/setters to Object.defineProperty

/**
 * Each consumer of the mavensmate API instantiates a client. 
 * **** Today, there is a 1:1 relationship between client and project (per the ATOM project design)
 * @param {Object} options [description]
 * @param {String} [opts.editor] - Name of the consuming editor (atom, sublime, etc.)
 * @param {String} [opts.settings] - Settings object (atom uses this)
 * @param {Boolean} [opts.headless] - Whether this client is headless or not (atom, sublime are headless, interactive terminals users are not)
 * @param {Boolean} [opts.verbose] - Whether this client is verbose (will output debug statements) - production clients should not have this enabled
 * @param {Object} [opts.program] - The CLI client passes in a commander.js program instance
 */
var Client = exports.Client = function(options) {
  this.editor     = options.editor;
  this.headless   = options.headless;
  this.verbose    = options.verbose;
  this.program    = options.program;
  this.settings   = options.settings || {};
  this.serverPort = options.serverPort;
  this._initConfig();
  logger = require('./logger')(this);
  if (this.editor === 'atom') { //sublime starts the server separately
    this.startUIServer();   
  }
  process.env.MAVENSMATE_EDITOR = this.editor;
  logger.debug('initiated client: ');
  logger.debug(this.toString());
};

inherits(Client, events.EventEmitter);

Client.prototype.toString = function() {
  return JSON.stringify({
    editor: this.editor,
    headless: this.headless,
    verbose: this.verbose,
    // program: this.program,
    settings: this.settings
  });
};

/**
 * Whether the client is interacting via the command line
 * @return {Boolean}
 */
Client.prototype.isCommandLine = function() {
  return this.program !== undefined && this.program !== null;
};

/**
 * Whether the client is headless (an editor plugging into the core mavensmate APIs like atom or sublime)
 * @return {Boolean}
 */
Client.prototype.isHeadless = function() {
  return this.headless;
};

/**
 * Whether the client is interactive (a human at a terminal)
 * @return {Boolean}
 */
Client.prototype.isInteractive = function() {
  return !this.isHeadless();
};

/**
 * Starts the local express.js UI server
 * @return {Nothing}
 */
Client.prototype.startUIServer = function() {
  this._server = new UIServer(this);
  this._server.start()
    .then(function(port) {
      logger.debug('mavensmate local express server listening on port: ' + port);
      process.env.MAVENSMATE_UI_SERVER_PORT = port;
    })
    .catch(function(err) {
      logger.debug('could not start local server: '+err.message);
    })
    .done();
};

Client.prototype.getServer = function() {
  return this._server;
};

/**
 * Destroys the client
 * @return {Nothing}
 */
Client.prototype.destroy = function() {
  this._server.stop();
};

/**
 * Returns the project associated with the client (currently a 1:1 relationship as per the Atom project model)
 * @return {Object} - Project instance
 */
Client.prototype.getProject = function() {
  return this._project;
};

/**
 * Sets the MavensMate project for the client
 * @param {String} path - local path of the project, reverts to process.cwd()
 * @param {Function} callback
 */
Client.prototype.setProject = function(path, callback) {
  this._project = new Project({ path: path });
  if (!this._project.initialized) {
    var isEphemeralProject = this.isCommandLine();
    this._project.initialize(false, isEphemeralProject)
      .then(function(response) {
        callback(null, response);
      })
      .catch(function(err) {
        logger.debug('Could not set project: '+err.message+ ' -> '+err.stack);
        callback(err);
      })
      .done();
  } else {
    callback(null, this._project);
  }
};

Client.prototype.reloadConfig = function() {
  config.remove('user-client');
  config.remove('default-client');
  config.remove('global');
  this._initConfig();
};

/**
 * Setup config with editor-specific settings, then globals
 * @return {Nothing}
 */
Client.prototype._initConfig = function() {
  config.env().argv().defaults(this.settings || {});

  if (this.editor.toLowerCase().indexOf('sublime') >= 0) {
    var defaultClientSettingsPath;
    var userClientSettingsPath;
    if (util.isMac()) {
      defaultClientSettingsPath = path.join(util.getHomeDirectory(), 'Library', 'Application Support', 'Sublime Text 3', 'Packages', 'MavensMate', 'mavensmate.sublime-settings');
      userClientSettingsPath = path.join(util.getHomeDirectory(), 'Library', 'Application Support', 'Sublime Text 3', 'Packages', 'User', 'mavensmate.sublime-settings');
    } else if (util.isWindows()) {
      defaultClientSettingsPath = path.join(util.getWindowsAppDataPath(), 'Sublime Text 3', 'Packages', 'MavensMate', 'mavensmate.sublime-settings');
      userClientSettingsPath = path.join(util.getWindowsAppDataPath(), 'Sublime Text 3', 'Packages', 'User', 'mavensmate.sublime-settings');
    } else if (util.isLinux()) {
      defaultClientSettingsPath = path.join(util.getHomeDirectory(), '.config', 'sublime-text-3', 'Packages', 'MavensMate', 'mavensmate.sublime-settings');
      userClientSettingsPath = path.join(util.getHomeDirectory(), '.config', 'sublime-text-3', 'Packages', 'User', 'mavensmate.sublime-settings');
    }

    // we add literals here instead of config.file bc we need to strip comments from the json before adding to the store
    if (fs.existsSync(userClientSettingsPath)) {
      config
        .add('user-client', { type: 'literal', store: util.getFileBody(userClientSettingsPath, true) });
    }
    if (fs.existsSync(defaultClientSettingsPath)) {
      config
        .add('default-client', { type: 'literal', store: util.getFileBody(defaultClientSettingsPath, true)});    
    }
  } else if (this.editor.toLowerCase() === 'atom') {
    var CSON = require('season');
    var atomSettingsPath;
    if (util.isMac()) {
      atomSettingsPath = path.join(util.getHomeDirectory(), '.atom', 'config.cson');
    } else if (util.isWindows()) {
      atomSettingsPath = path.join(util.getHomeDirectory(), '.atom', 'config.cson');
    } else if (util.isLinux()) {
      atomSettingsPath = path.join(util.getHomeDirectory(), '.atom', 'config.cson');
    }
    if (fs.existsSync(atomSettingsPath)) {
      var atomSettings = CSON.readFileSync(atomSettingsPath);
      if (atomSettings['*'] && atomSettings['*'] && atomSettings['*']['MavensMate-Atom']) {
        config
          .add('user-client', { type: 'literal', store: atomSettings['*']['MavensMate-Atom'] });  
      }
    }  
  }   

  config.file('global', path.join(__dirname,'config','default.json'));

  var mmApiVersion = config.get('mm_api_version');
  if (!util.endsWith(mmApiVersion,'.0')) {
    mmApiVersion = mmApiVersion+'.0';
    config.set('mm_api_version', mmApiVersion);
  }

};

/**
 * Executes a named command
 * @param  {String}   command  - name of the command, e.g. new-project
 * @param  {Object}   options  - context : { args : { ui : true }, payload: { username: foo, password: bar } }
 * @param  {Function} callback - callback, will be called when command finishes executing
 * @return {Nothing}
 */
Client.prototype.executeCommand = function(command, payload, callback) {
  logger.debug('\n\n==================> executing command: '+command+'\n');
  // if user did not pass in context, the second param is the callback
  if (arguments.length === 2 && _.isFunction(payload)) {
    callback = payload;
    payload = {};
  }
  logger.debug('payload is: '+JSON.stringify(payload));
  var commandClass = up.capitalize(up.camelize(command))+'Command'; // => new-project -> NewProjectCommand
  logger.debug('command class is: '+commandClass);
  var commandInstance = new Client[commandClass](this, payload, callback);
  commandInstance.setProject(this.getProject());
  return commandInstance.execute();
};

/**
 * export command classes from lib/commands 
 */ 
var cmdPath = path.join(__dirname, 'commands');
var commandFiles = util.walkSync(cmdPath);
_.each(commandFiles, function(filepath) {
  Client[up.capitalize(up.camelize(path.basename(filepath).split('.')[0])+'Command')] = require(filepath).command;
});

exports.createClient = function (options) {
  return new Client(options);
};