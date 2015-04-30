var fs = require('fs'),
    jsforce = require('jsforce'),
    assetName = '',
    jsForceConfig;


var WebpackSalesforceDeployPlugin = module.exports = function (options) {

    //define the incoming options from the webpack.saleforce.deploy.js
    this.options = options || {};
    assetName = options.assetName;

    // get the Org credintials from the jsforce.config.js file.
    try { jsForceConfig = require(options.jsConfigPath) } catch (e) {}

};

WebpackSalesforceDeployPlugin.prototype.triggerDeploy = function (stats) {

    var error = '';

    if (stats.hasErrors()) {

        error = stats.compilation.errors[0];

    } else if (this.options.resourcePath !== 'undefined') {

        // read the bundle.js file and pass the data to the zip module
        fs.readFile(this.options.resourcePath, function (err, data) {

            if (err) { throw err; }

            // create a zip out of the bundle.js
            var zip = new require('node-zip')();

            zip.file("bundle.js", data);

            var zData = zip.generate({base64: true, compression: 'DEFLATE'});

            // define the connection and endpoint
            var conn = new jsforce.Connection({loginUrl : 'https://login.salesforce.com'});

            // login to the org
            conn.login(jsForceConfig.username, jsForceConfig.password + jsForceConfig.token, function (err, res) {

                // create you metadata for the static resource
                var metadata = [{
                    fullName: 'assetName',
                    content: zData,
                    contentType: 'application/zip',
                    cacheControl: 'Private'
                }];

                // upsert to resource
                conn.metadata.upsert('StaticResource', metadata, function (err, results) {
                    if (err) {

                        console.log(err);

                    } else {

                        if (results.success === true) {
                            console.log('The Static Resouce: ' + assetName + ' was updated!');

                        } else {

                            console.log(results);

                        }

                    }

                }); // end of upsert

            }); // end of login

        }); // end of readFile

    }

};

WebpackSalesforceDeployPlugin.prototype.apply = function (compiler) {

    compiler.plugin('done', this.triggerDeploy.bind(this));

};
