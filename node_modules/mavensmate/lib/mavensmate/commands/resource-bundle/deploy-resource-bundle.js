/* compile-metadata commander component
 * To use add require('../cmds/new-connection.js')(program) to your commander.js based node executable before program.parse
 */
'use strict';

var util                    = require('../../util').instance;
var ResourceBundleService   = require('../../resource-bundle');
var inherits                = require('inherits');
var BaseCommand             = require('../../command');

function Command() {
  Command.super_.call(this, Array.prototype.slice.call(arguments, 0));
}

inherits(Command, BaseCommand);

Command.prototype.execute = function() {
  var self = this;

  var project = self.getProject();
  var bundleService = new ResourceBundleService(project);
  bundleService.deploy(self.payload.paths)
    .then(function() {
      self.respond('Resource bundle successfully deployed');
    })
    .catch(function(error) {
      self.respond('Could not deploy resource bundle', false, error);
    })
    .done();  
};

exports.command = Command;
exports.addSubCommand = function(client) {
  client.program
    .command('deploy-resource-bundle [bundlePath]')
    .description('Deploys a resource bundle to the server, e.g. mavensmate deploy-resource-bundle path/to/resource/bundle ')
    .action(function(bundlePath){
      if (bundlePath) {
        client.executeCommand(this._name, { paths: util.getAbsolutePaths( [ bundlePath ] ) });
      } else {
        console.error('Please specify a valid bundle path');
        process.exit(1);
      }
    });
};