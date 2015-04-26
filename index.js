var mavensmate = require('mavensmate'),
path = require('path'),
payload = {
    paths :[ __dirname + '/../../resource-bundles/' + path.basename(__dirname) + '.resource/']
};

var WebpackSalesforceDeployPlugin = module.exports = function(options) {
    this.options = options || {};
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
        client.setProject(__dirname + '/../../', function(err, response) {
            client.executeCommand('deploy-resource-bundle', payload, function(err, response) {
                console.log(response);
                // full list of commands can be found in lib/mavensmate/commands
            });
        });

    }
};
