/* refresh-metadata commander component
 * To use add require('../cmds/refresh-metadata.js')(program) to your commander.js based node executable before program.parse
 */
'use strict';

var util                  = require('../../util').instance;
var inherits              = require('inherits');
var BaseCommand           = require('../../command');
var RefreshDelegate       = require('../../refresh');
var logger                = require('winston');

function Command() {
  Command.super_.call(this, Array.prototype.slice.call(arguments, 0));
}

inherits(Command, BaseCommand);

Command.prototype.execute = function() {
  var self = this;

  var project = self.getProject();
  var refreshDelegate = new RefreshDelegate(project, self.payload.paths);
  refreshDelegate.execute()
    .then(function(result) {
      logger.debug('refresh command result: ');
      logger.debug(result);
      self.respond('Metadata successfully refreshed');
    })
    .catch(function(error) {
      self.respond('Could not refresh metadata', false, error);
    })
    .done();
};

exports.command = Command;
exports.addSubCommand = function(client) {
  client.program
    .command('refresh-metadata [path]')
    .alias('refresh')
    .description('Refreshes metadata from the salesforce.com server')
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