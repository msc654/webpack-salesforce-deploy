/* compile-metadata commander component
 * To use add require('../cmds/compile-metadata.js')(program) to your commander.js based node executable before program.parse
 */
'use strict';

var util                  = require('../../util').instance;
var OrgConnectionService  = require('../../org-connection');
var inherits              = require('inherits');
var BaseCommand           = require('../../command');

function Command() {
  Command.super_.call(this, Array.prototype.slice.call(arguments, 0));
}

inherits(Command, BaseCommand);

Command.prototype.execute = function() {
  var self = this;

  var project = self.getProject();
  var orgConnectionService = new OrgConnectionService(project);
  orgConnectionService.update(self.payload.id, self.payload.username, self.payload.password, self.payload.orgType)
    .then(function(result) {
      self.respond(result);
    })
    .catch(function(error) {
      self.respond('Could not update org connection', false, error);
    })
    .done();  
};

exports.command = Command;
exports.addSubCommand = function(client) {
  client.program
    .command('update-connection [connectiondId] [username] [password] [orgType]')
    .description('Updates a new deployment connection')
    .action(function(connectiondId, username, password, orgType){
      client.executeCommand(this._name, {
        id: connectiondId,
        username: username,
        password: password,
        orgType: orgType
      }); 
    });
};