/* flush-logs commander component
 * To use add require('../cmds/flush-logs.js')(program) to your commander.js based node executable before program.parse
 */
'use strict';

var inherits    = require('inherits');
var BaseCommand = require('../../command');
var path        = require('path');
var fs          = require('fs-extra');

function Command() {
  Command.super_.call(this, Array.prototype.slice.call(arguments, 0));
}

inherits(Command, BaseCommand);

Command.prototype.execute = function() {
  try {
    var self = this;
    var project = self.getProject();
    
    var debugDirectory = path.join( project.path, 'debug' );
    if (fs.existsSync( debugDirectory )) {
      fs.removeSync(debugDirectory);
    }

    self.respond('Successfully flushed debug logs');
  } catch(err) {
    self.respond('Could not flush logs', false, err);
  }
};

exports.command = Command;
exports.addSubCommand = function(client) {
  client.program
    .command('flush-logs')
    .alias('delete-logs')
    .description('Deletes all log files in a project')
    .action(function(/* Args here */){
      client.executeCommand(this._name);  
    });
};