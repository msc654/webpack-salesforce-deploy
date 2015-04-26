/* compile-metadata commander component
 * To use add require('../cmds/compile-metadata.js')(program) to your commander.js based node executable before program.parse
 */
'use strict';

var util            = require('../../util').instance;
var inherits        = require('inherits');
var BaseCommand     = require('../../command');
var CompileDelegate  = require('../../compile');

function Command() {
  Command.super_.call(this, Array.prototype.slice.call(arguments, 0));
}

inherits(Command, BaseCommand);

Command.prototype.execute = function() {
  var self = this;
  var project = self.getProject();
  var compileDelegate = new CompileDelegate(project, self.payload.paths, self.payload.force);
  compileDelegate.execute()
    .then(function(result) {
      self.respond(result);
    })
    .catch(function(error) {
      self.respond('Could not compile metadata', false, error);
    })
    .done();
};

exports.command = Command;
exports.addSubCommand = function(client) {
  client.program
    .command('compile-metadata [path]')
    .alias('compile')
    .description('Compiles metadata')
    .action(function(path){
      if (path) {
        client.executeCommand(this._name, {
          paths : util.getAbsolutePaths( [ path ] )
        }); 
      } else {
        var self = this;
        util.getPayload()
          .then(function(payload) {
            client.executeCommand(self._name, payload); 
          });
      }
    });
};