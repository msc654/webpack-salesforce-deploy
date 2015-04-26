/* index-metadata commander component
 * To use add require('../cmds/index-metadata.js')(program) to your commander.js based node executable before program.parse
 */
'use strict';

var util          = require('../../util').instance;
var inherits      = require('inherits');
var BaseCommand   = require('../../command');

function Command() {
  Command.super_.call(this, Array.prototype.slice.call(arguments, 0));
}

inherits(Command, BaseCommand);

Command.prototype.execute = function() {
  var self = this;
  var project = self.getProject();
  project.indexSymbols(self.payload.className)
    .then(function() {
      self.respond('Symbols successfully indexed for '+self.payload.className);
    })
    .catch(function(error) {
      self.respond('Could not index symbols', false, error);
    })
    .done();
};

exports.command = Command;
exports.addSubCommand = function(client) {
  client.program
    .command('index-apex-class [className]')
    .description('Indexes Apex class\'s symbols')
    .action(function(className){
      client.executeCommand(this._name, {
        className : className
      }); 
    });
};