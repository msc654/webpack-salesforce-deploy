var fs = require('fs'),
    Zip = require('node-zip'),
    jsforce = require('jsforce'),
    assetName = '',
    jsForceConfig;

var WebpackSalesforceDeployPlugin = module.exports = function (options) {
    // Define the incoming options from the webpack.saleforce.deploy.js
    this.options = options || {};
    assetName = options.assetName;
    // get the Org credintials from the jsforce.config.js file.
    try { jsForceConfig = require(options.jsConfigPath); } catch (e) { }
};

WebpackSalesforceDeployPlugin.prototype.apply = function (compiler) {
    compiler.plugin('done', this.triggerDeploy.bind(this));
};

WebpackSalesforceDeployPlugin.prototype.triggerDeploy = function (stats) {
    var self = this,
        error = '',
        rawDir = this.options.resourcePath;

    var dir = rawDir.substring(0, rawDir.indexOf('bundle.js'));

    if (stats.hasErrors()) {
        error = stats.compilation.errors[0];
        console.log(error);
    } else if (self.options.resourceFolderPath !== 'undefined') {
        fs.readdir(dir, function (err, files) {
            var zipApp = new Zip(),
                zipVendor = new Zip(),
                zipCommons = new Zip();

            if (err) throw err;
            addFilesToStaticResources(zipApp, zipVendor, zipCommons, files);
            if (self.options.copy || self.options.copy === undefined) {
                copyStaticResources(zipApp, zipVendor, zipCommons);
            }
            if (self.options.deploy || self.options.deploy === undefined) {
                deployStaticResources(zipApp, zipVendor, zipCommons);
            }
        }); // end of directory read
    } // end of If Statement
    function addFilesToStaticResources(zipApp, zipVendor, zipCommons, files) {
        files.forEach(function (file) {
            var data = fs.readFileSync(dir + file, 'utf8');

            switch (file) {
                case 'bundle.js':
                    zipApp.file(file, data);
                    break;
                case 'vendor.js':
                    zipVendor.file(file, data);
                    break;
                case 'commons.js':
                    zipCommons.file(file, data);
                    break;
            }
        });
    }
    function deployStaticResources(zipApp, zipVendor, zipCommons) {
        // Create the connection object
        var conn = new jsforce.Connection({ loginUrl: jsForceConfig.url || 'https://login.salesforce.com' }),
            metaDataPayload = [];

        if (zipApp.file(/./g).length > 0) {
            metaDataPayload.push({
                fullName: assetName,
                content: zipApp.generate({ base64: true, compression: 'DEFLATE' })
            });
        }
        if (zipVendor.file(/./g).length > 0) {
            metaDataPayload.push({
                fullName: 'vendor',
                content: zipVendor.generate({ base64: true, compression: 'DEFLATE' })
            });
        }
        if (zipCommons.file(/./g).length > 0) {
            metaDataPayload.push({
                fullName: 'commons',
                content: zipCommons.generate({ base64: true, compression: 'DEFLATE' })
            });
        }
        metaDataPayload = metaDataPayload.map(function (bundleDefinition) {
            return {
                fullName: bundleDefinition.fullName,
                content: bundleDefinition.content,
                contentType: 'application/zip',
                cacheControl: 'Private'
            };
        });

        // Login to the org
        conn.login(jsForceConfig.username, jsForceConfig.password + jsForceConfig.token, function (err, res) {
            if (err) throw err;
            // Actually deploy the Static Resource to Salesforce
            conn.metadata.upsert('StaticResource', metaDataPayload, function (err, results) {
                if (err) {
                    console.log(err);
                } else {
                    if ((results || results[0]) && (results.created === false || results[0].success === true)) {
                        console.log('The Static Resouce: ' + assetName + ', vendor and commons was updated!');
                    } else {
                        console.log(results);
                    }
                }
            }); // end of upsert
        }); // end of login
    }
    function copyStaticResources(zipApp, zipVendor, zipCommons) {
        var zDataAppBuffer = zipApp.generate({ type: 'nodebuffer', compression: 'DEFLATE' }),
            zDataVendorBuffer = zipVendor.generate({ type: 'nodebuffer', compression: 'DEFLATE' }),
            zDataCommonsBuffer = zipCommons.generate({ type: 'nodebuffer', compression: 'DEFLATE' });

        if (zipApp.file(/./g).length > 0) {
            fs.writeFile('./../../src/staticresources/' + assetName + '.resource', zDataAppBuffer, 'binary');
        }
        if (zipVendor.file(/./g).length > 0) {
            fs.writeFile('./../../src/staticresources/' + 'vendor' + '.resource', zDataVendorBuffer, 'binary');
        }
        if (zipCommons.file(/./g).length > 0) {
            fs.writeFile('./../../src/staticresources/' + 'commons' + '.resource', zDataCommonsBuffer, 'binary');
        }
    }
};
