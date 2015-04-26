/* new_metadata commander component
 * To use add require('../cmds/new-metadata.js')(program) to your commander.js based node executable before program.parse
 */
'use strict';

var Promise           = require('bluebird');
var _                 = require('lodash');
var util              = require('../../util').instance;
var inherits          = require('inherits');
var BaseCommand       = require('../../command');
var EditorService     = require('../../editor');
var LightningService  = require('../../lightning');
var RefreshDelegate   = require('../../refresh');
var path              = require('path');
var MavensMateFile    = require('../../file').MavensMateFile;

function Command() {
  Command.super_.call(this, Array.prototype.slice.call(arguments, 0));
}

inherits(Command, BaseCommand);

Command.prototype.execute = function() {
  var self = this;
  if (self.isUICommand() && self.client.editor === 'sublime') {
    var editorService = new EditorService(self.client);
    editorService.launchUI('new-lightning-app');   
  } else {
    var project = self.getProject();
    var lightningService = new LightningService(project);
    var apiName = self.payload.apiName;
    var newAuraFile;
    var newBundleId;
    return lightningService.createBundle(apiName, self.payload.description)
      .then(function(result) {
        newBundleId = result.id;
        var createPromises = [];
        createPromises.push(lightningService.createApplication(newBundleId));
        if (self.payload.createController) {
          createPromises.push(lightningService.createController(newBundleId));
        }
        if (self.payload.createHelper) {
          createPromises.push(lightningService.createHelper(newBundleId));
        }
        if (self.payload.createStyle) {
          createPromises.push(lightningService.createStyle(newBundleId));
        }
        if (self.payload.createDocumentation) {
          createPromises.push(lightningService.createDocumentation(newBundleId));
        }
        if (self.payload.createRenderer) {
          createPromises.push(lightningService.createRenderer(newBundleId));
        }
        return Promise.all(createPromises);
      })
      .then(function(result) {
        var failures = _.where(result, { 'success': false });
        if (failures.length > 0) {
          lightningService.deleteBundle(newBundleId)
            .then(function() {
              throw new Error(JSON.stringify(failures));
            });
        } else {
          newAuraFile = new MavensMateFile({ project: project, path: path.join(project.path, 'src', 'aura', apiName) });
          newAuraFile.writeToDiskSync();
          project.packageXml.subscribe(newAuraFile); 
          return project.packageXml.writeFileSync();         
        }
      })
      .then(function() {
        var refreshDelegate = new RefreshDelegate(project, [ newAuraFile.path ]);
        return refreshDelegate.execute();
      })
      .then(function() {
        return project.indexLightning();
      })
      .then(function() {
        self.respond('Lightning app created successfully');
      })
      .catch(function(error) {
        self.respond('Could not create lighting application', false, error);
      })
      .done(); 
  } 
};

exports.command = Command;
exports.addSubCommand = function(client) {
  client.program
    .command('new-lightning-app')
    .option('--ui', 'Launches the default UI for the selected command.')
    .description('Creates new lightning application')
    .action(function() {
      if (this.ui) {
        client.executeCommand(this._name, { args: { ui: true } });    
      } else if (client.isHeadless()) {
        var self = this;
        util.getPayload()
          .then(function(payload) {
            client.executeCommand(self._name, payload); 
          });
      }  
    });
};