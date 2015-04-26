/* new_project commander component
 * To use add require('../cmds/new-project.js')(program) to your commander.js based node executable before program.parse
 */
'use strict';

var _                 = require('lodash');
var util              = require('../../util').instance;
var merge             = require('merge');
var Project           = require('../../project');
var BaseCommand       = require('../../command');
var SalesforceClient  = require('../../sfdc-client');
var inherits          = require('inherits');
var logger            = require('winston');
var EditorService     = require('../../editor');
var config            = require('../../config');

var _getSobjectList = function(describeResult) {
  var sobjects = [];
  _.each(describeResult.sobjects, function(so) {
    sobjects.push(so.name);
  });
  return sobjects;
};

function Command() {
  Command.super_.call(this, Array.prototype.slice.call(arguments, 0));
}

inherits(Command, BaseCommand);

Command.prototype.execute = function() {
  var self = this;

  if (self.isUICommand() && self.client.editor === 'sublime') {
    var editorService = new EditorService(self.client);
    editorService.launchUI('new-project');
  } else if (self.client.isHeadless()) {
    
    if (!self.payload.username || !self.payload.password || !self.payload.name) {
      return self.respond('Please specify username, password, and project name', false, new Error('Please specify username, password, and project name'));  
    }

    var newProject;
    var sfdcClient = new SalesforceClient(self.payload);
    sfdcClient.initialize()
      .then(function() {
        newProject = new Project(self.payload);
        newProject.sfdcClient = sfdcClient;
        return newProject.initialize(true);
      })
      .then(function() {
        logger.debug('Initiated new project, prepping to write to disk');
        return newProject.retrieveAndWriteToDisk();
      })
      .then(function() {
        logger.debug('Written to disk ...');
        if (self.client.editor) {
          logger.debug('attempting to open in editor');
          new EditorService(self.client).open(newProject.path);
        }
        self.respond('Project created successfully');
      })
      .catch(function(error) {
        logger.debug('Could not create project: ');
        logger.debug(error.stack);
        self.respond('Could not create project', false, error);
      })
      .done();

  } else if (self.client.isInteractive()) { 
    var userInput;

    var workspaces = config.get('mm_workspace');
    if (workspaces === '') {
      workspaces = [util.getHomeDirectory()];
    } else if (!_.isArray(workspaces)) {
      workspaces = [workspaces];
    }
    var inquirer = require('inquirer');
    inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'What would you like to name your project?'
      },
      {
        type: 'list',
        name: 'workspace',
        message: 'Where would you like to put your project?',
        choices: workspaces
      },
      {
        type: 'list',
        name: 'orgType',
        message: 'What kind of org who you like to connect to?',
        choices: [
          'Production',
          'Sandbox',
          'Prerelease',
          'Custom'
        ]
      },
      {
        type: 'input',
        name: 'username',
        message: 'Please enter your salesforce.com username'
      },
      {
        type: 'password',
        name: 'password',
        message: 'Please enter your salesforce.com password'
      },
      {
        type: 'input',
        name: 'securityToken',
        message: 'Please enter your security token (optional)'
      }
    ], function( answers ) {
      // the first few prompts ensure we have the proper context to connect to salesforce,
      // do a describe and offer a list of types to download 
      // console.log( JSON.stringify(answers, null, '  ') );
      userInput = answers;

      var opts = {
        username : answers.username,
        password : answers.password,
        orgType : answers.orgType,
        securityToken : answers.token
      };

      var sfdcClient = new SalesforceClient(opts);

      sfdcClient.initialize()
        .then(function() {
          return sfdcClient.describeGlobal();
        })
        .then(function(describeResult) {
          
          // assemble a list of sobject types to present to user
          var sobjects = _getSobjectList(describeResult);
          var apexVfMetadata = [
            'ApexClass',
            'ApexComponent',
            'ApexPage',
            'ApexTrigger',
            'StaticResource'
          ];
          var unpackagedChoices = [
            new inquirer.Separator('Apex/Visualforce')
          ];
          _.each(apexVfMetadata, function(m) {
            unpackagedChoices.push({
              name: m,
              checked: true
            });
          });
          unpackagedChoices.push(new inquirer.Separator('Other metadata types:'));
          _.each(sobjects, function(so) {
            if (apexVfMetadata.indexOf(so) === -1) {
              unpackagedChoices.push({
                name: so
              });
            }
          });

          // present list for selection (apex/vf types selected by default)
          inquirer.prompt([
            {
              type: 'list',
              name: 'projectType',
              message: 'Would you like to download a package or select from unpackaged metadata?',
              choices: [
                'Unpackaged'
                // 'Package'
              ]
            } 
          ], function(answers) {
            userInput = merge.recursive(answers, userInput);

            if (answers.projectType === 'Package') {
              // present list of packages
              inquirer.prompt([
                {
                  type: 'checkbox',
                  message: 'Please select the packages you wish to download',
                  name: 'packages',
                  choices: choices,
                  validate: function( answer ) {
                    if ( answer.length < 1 ) {
                      return 'You must choose at least one package.';
                    }
                    return true;
                  }
                }
              ], function(answers) {
                userInput = merge.recursive(answers, userInput);
                sfdcClient.retrievePackages(answers.packages);  
                // todo: ensure project creation adds "packages" structure to settings to keep track of packages
                var sfdcClient = new SalesforceClient(userInput);
                sfdcClient.initialize()
                  .then(function() {
                    newProject = new Project(userInput);
                    return newProject.initialize(true);
                  })
                  .then(function() {
                    return newProject.retrieveAndWriteToDisk();
                  })
                  .catch(function(error) {
                    console.log('error!');
                    console.log(error.stack);
                  })
                  ['finally'](function() {
                    // console.log('done!');
                  });
              }); 
            } else {
              // present list for selection (apex/vf types selected by default)
              inquirer.prompt([
                {
                  type: 'checkbox',
                  message: 'Please select the metadata types you wish to download as part of your project',
                  name: 'package',
                  choices: unpackagedChoices,
                  validate: function( answer ) {
                    if ( answer.length < 1 ) {
                      return 'You must choose at least one metadata type.';
                    }
                    return true;
                  }
                }
              ], function(answers) {
                userInput = merge.recursive(answers, userInput);
                var newProject;
                var sfdcClient = new SalesforceClient(userInput);
                sfdcClient.initialize()
                  .then(function() {
                    newProject = new Project(userInput);
                    newProject.sfdcClient = sfdcClient;
                    return newProject.initialize(true);
                  })
                  .then(function() {
                    logger.debug('Initiated new project, prepping to write to disk');
                    return newProject.retrieveAndWriteToDisk();
                  })
                  .then(function() {
                    logger.debug('Written to disk ...');
                    if (self.client.editor) {
                      logger.debug('attempting to open in editor');
                      new EditorService(self.client).open(newProject.path);
                    }
                    self.respond('Project created successfully');
                  })
                  .catch(function(error) {
                    logger.debug('Could not create project: ');
                    logger.debug(error.stack);
                    self.respond('Could not create project', false, error);
                  })
                  .done();
              }); 
            }
          }); 
        })
        .catch(function(error) {
          return self.respond(self, 'Could not create project', false, error);
        })
        ['finally'](function() {
          // TODO: clean up directory if one was created
        });
    });
  }
};

exports.command = Command;
exports.addSubCommand = function(client) {
  client.program
    .command('new-project')
    .option('--ui', 'Launches the default UI for the selected command.')
    .description('Creates a new Salesforce1 project')
    .action(function(){
      // if user has included the ui flag, launch the ui
      // else if this client is headless, read STDIN
      // else the client must be interactive
      if (this.ui) {
        client.executeCommand(this._name, { args: { ui: true } });    
      } else if (client.isHeadless()) {
        var self = this;
        util.getPayload()
          .then(function(payload) {
            client.executeCommand(self._name, payload); 
          });
      } else {
        client.executeCommand(this._name);    
      }   
    }); 
};
