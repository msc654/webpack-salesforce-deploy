/* compile-project commander component
 * To use add require('../cmds/compile-project.js')(program) to your commander.js based node executable before program.parse
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
  
  var project = self.getProject();
  project.compile()
    .then(function(result) {
      self.respond(result);
    })
    .catch(function(error) {
      self.respond('Could not compile project', false, error);
    })
    .done();
};

exports.command = Command;
exports.addSubCommand = function(client) {
  client.program
    .command('compile-project')
    .description('Compiles project based on package.xml')
    .action(function(/* Args here */){
      client.executeCommand(this._name);
    });
};