var mavensmate = require('mavensmate'),
payload = {};

var WebpackSalesforceDeployPlugin = module.exports = function(options) {
    this.options = options || {};
    payload.paths = [];
    payload.paths.push = this.options.resourcePath;
};

WebpackSalesforceDeployPlugin.prototype.triggerDeploy = function(stats) {
    var error;
    if (stats.hasErrors()) {
        error = stats.compilation.errors[0];

    } else if (!this.lastBuildSucceeded || this.options.alwaysNotify) {

        console.log('build was successful');

        var client = mavensmate.createClient({
            editor: '', // supported editor names: atom, sublime
            headless: true,
            verbose: true
        });

        client.setProject(this.options.projectPath, function(err, response) {
            client.executeCommand('deploy-resource-bundle', payload, function(err, response) {
                console.log(response);
                console.log(err);
                // full list of commands can be found in lib/mavensmate/commands
            });
        });

    }
};

WebpackSalesforceDeployPlugin.prototype.apply = function(compiler) {
    compiler.plugin('done', this.triggerDeploy.bind(this));
};
