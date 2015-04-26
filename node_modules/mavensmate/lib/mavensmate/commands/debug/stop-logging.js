/* start-logging commander component
 * To use add require('../cmds/start-logging.js')(program) to your commander.js based node executable before program.parse
 */
'use strict';

var inherits    = require('inherits');
var BaseCommand = require('../../command');
var moment      = require('moment');

function Command() {
  Command.super_.call(this, Array.prototype.slice.call(arguments, 0));
}

inherits(Command, BaseCommand);

Command.prototype.execute = function() {
  var self = this;
  var project = self.getProject();
  var sfdcClient = project.sfdcClient;
  var projectDebugSettings = project.getDebugSettingsSync();
  sfdcClient.stopLogging(projectDebugSettings.users)
    .then(function() {
      self.respond('Stopped logging for debug users');
    })
    .catch(function(error) {
      self.respond('Could not stop logging', false, error);
    })
    .done();
};

exports.command = Command;
exports.addSubCommand = function(client) {
  client.program
    .command('stop-logging')
    .description('Stops logging Apex execution for all user ids listed in your project\'s config/.debug file')
    .action(function(/* Args here */){
      client.executeCommand(this._name);  
    });
};