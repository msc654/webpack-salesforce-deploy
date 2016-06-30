var fs = require('fs'),
  jsforce = require('jsforce'),
  assetName = '',
  jsForceConfig;

var WebpackSalesforceDeployPlugin = module.exports = function (options) {
  //define the incoming options from the webpack.saleforce.deploy.js
  this.options = options || {};
  assetName = options.assetName;
  // get the Org credintials from the jsforce.config.js file.
  try { jsForceConfig = require(options.jsConfigPath) } catch (e) { }
};

WebpackSalesforceDeployPlugin.prototype.triggerDeploy = function (stats) {
  var error = '';
  if (stats.hasErrors()) {
    error = stats.compilation.errors[0];
  } else if (this.options.resourceFolderPath !== 'undefined') {
    var rawDir = this.options.resourcePath;
    var dir = rawDir.substring(0, rawDir.indexOf('bundle.js'));
    fs.readdir(dir, function (err, files) {
      if (err) throw err;
      var c = 0;
      var zipApp = new require('node-zip')();
      var zipVendor = new require('node-zip')();
      var zipCommons = new require('node-zip')();
      // Add files to their respective statuc resources
      files.forEach(function (file) {
        // Not too sure why we're itterating a counter
        c++;
        var data = fs.readFileSync(dir + file, 'utf8');
        if (err) throw err;
        if (file === 'bundle.js') {
          zipApp.file(file, data);
        }
        if (file === 'vendor.js') {
          zipVendor.file(file, data);
        }
        if (file === 'commons.js') {
          zipCommons.file(file, data);
        }
        if (0 === --c) {
          console.log(file);
        }
      });
      if (this.options.copy) {
        var zDataAppBuffer = zipApp.generate({ type: "nodebuffer", compression: "DEFLATE" });
        var zDataVendorBuffer = zipVendor.generate({ type: "nodebuffer", compression: "DEFLATE" });
        var zDataCommonsBuffer = zipCommons.generate({ type: "nodebuffer", compression: "DEFLATE" });
        // Copy the zip to the StaticResource folder
        fs.writeFile('./../../src/staticresources/' + assetName + '.resource', zDataAppBuffer, 'binary');
        fs.writeFile('./../../src/staticresources/' + 'vendor' + '.resource', zDataVendorBuffer, 'binary');
        fs.writeFile('./../../src/staticresources/' + 'commons' + '.resource', zDataCommonsBuffer, 'binary');
      }
      if (this.options.deploy) {
        var zDataApp = zipApp.generate({ base64: true, compression: 'DEFLATE' });
        var zDataVendor = zipVendor.generate({ base64: true, compression: 'DEFLATE' });
        var zDataCommons = zipCommons.generate({ base64: true, compression: 'DEFLATE' });
        // Create the connection object
        var conn = new jsforce.Connection({ loginUrl: jsForceConfig.url || 'https://login.salesforce.com' });
        // Login to the org
        conn.login(jsForceConfig.username, jsForceConfig.password + jsForceConfig.token, function (err, res) {
          // Create you metadata for the static resource
          var metaDataPayload = getPayload(
            [
              {
                fullName: assetName,
                content: zDataApp
              }, {
                fullName: 'vendor',
                content: zDataVendor
              }, {
                fullName: 'commons',
                content: zDataCommons
              }
            ]
          );
          // Actually deploy the Static Resource to Salesforce
          conn.metadata.upsert('StaticResource', metaDataPayload, function (err, results) {
            if (err) {
              console.log(err);
            } else {
              if (results[0].success === true) {
                console.log('The Static Resouce: ' + assetName + ', vendor and commons was updated!');
              } else {
                console.log(results);
              }
            }
          }); // end of upsert
        }); // end of login
      }
    }); // end of directory read
  } // end of If Statement
  function getPayload(bundleDefinitions) {
    return bundleDefinitions.map(function (bundleDefinition) {
      return {
        fullName: bundleDefinition.fullName,
        content: bundleDefinition.content,
        contentType: 'application/zip',
        cacheControl: 'Private'
      }
    })
  }
};

WebpackSalesforceDeployPlugin.prototype.apply = function (compiler) {
  compiler.plugin('done', this.triggerDeploy.bind(this));
};
