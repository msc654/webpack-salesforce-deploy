/* clean-project commander component
 * To use add require('../cmds/clean-project.js')(program) to your commander.js based node executable before program.parse
 */
'use strict';

var inherits    = require('inherits');
var BaseCommand = require('../../command');

function Command() {
  Command.super_.call(this, Array.prototype.slice.call(arguments, 0));
}

inherits(Command, BaseCommand);

Command.prototype.execute = function() {
  var self = this;
  self.getProject().clean()
    .then(function() {
      self.respond('Project cleaned successfully');
    })
    .catch(function(error) {
      self.respond('Could not clean project', false, error);
    })
    .done();
};

exports.command = Command;
exports.addSubCommand = function(client) {
  client.program
    .command('clean-project')
    .alias('clean')
    .description('Retrieves metadata from server based on project package.xml file, resets session')
    .action(function(/* Args here */){
      client.executeCommand(this._name);  
    });
};