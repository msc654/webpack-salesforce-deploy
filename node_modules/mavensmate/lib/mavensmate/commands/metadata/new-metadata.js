/* new_metadata commander component
 * To use add require('../cmds/new-metadata.js')(program) to your commander.js based node executable before program.parse
 */
'use strict';

var util            = require('../../util').instance;
var MavensMateFile  = require('../../file').MavensMateFile;
var Deploy          = require('../../deploy');
var inherits        = require('inherits');
var BaseCommand     = require('../../command');
var EditorService   = require('../../editor');
var path            = require('path');
// var logger          = require('winston');

function Command() {
  Command.super_.call(this, Array.prototype.slice.call(arguments, 0));
}

inherits(Command, BaseCommand);

Command.prototype.execute = function() {
  var self = this;
  if (self.isUICommand() && self.client.editor === 'sublime') {
    var editorService = new EditorService(self.client);
    editorService.launchUI('new-metadata', { type: self.payload.args.type });
  } else {
    var project = self.getProject();
    var newFile = new MavensMateFile({ project: project });
    newFile.setTypeByXmlName(self.payload.metadataTypeXmlName);
    newFile.template = self.payload.template;
    newFile.templateValues = self.payload.templateValues;
    newFile.name = self.payload.templateValues.api_name || self.payload.templateValues.apiName;
    newFile.setAbstractPath();
    var deploy = new Deploy({ project: project });
    var deployOptions = {
      rollbackOnError: true,
      performRetrieve: true
    };
    var deployResult;
    return deploy.execute(newFile, deployOptions)
      .then(function(result) {
        deployResult = result;
        return project.updateLocalStore(deployResult.details.retrieveResult.fileProperties);
      })
      .then(function() {
        project.packageXml.subscribe(newFile);
        return project.packageXml.writeFile();
      })
      .then(function() {
        if (self.client.editor) {
          var newMetadataPath = path.join(project.path, 'src', newFile.type.directoryName, [newFile.name, newFile.type.suffix].join('.'));
          new EditorService(self.client).open(newMetadataPath);
        } 
        self.respond(deployResult);
      })
      .catch(function(error) {
        self.respond('Could not create metadata', false, error);
      })
      .done(); 
  } 
};

exports.command = Command;
exports.addSubCommand = function(client) {
  client.program
    .command('new-metadata')
    .option('--ui', 'Launches the default UI for the selected command.')
    .option('-t, --type [type]', 'Type of metadata to create (ApexClass, ApexPage, ApexTrigger, ApexComponent, etc.')
    .description('Creates new metadata based on supplied template and params')
    .action(function() {
      if (this.ui) {
        client.executeCommand(this._name, { args: { ui: true, type: this.type } });    
      } else if (client.isHeadless()) {
        var self = this;
        util.getPayload()
          .then(function(payload) {
            client.executeCommand(self._name, payload); 
          });
      }  
    });
};