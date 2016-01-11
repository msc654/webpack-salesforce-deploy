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

    } else if (this.options.resourceFolderPath !== 'undefined') {

        var rawDir = this.options.resourcePath;
        var dir = rawDir.substring(0, rawDir.indexOf('bundle.js'));

        fs.readdir(dir,function(err,files){
            if (err) throw err;
            
            var c=0;
            
            var zipApp = new require('node-zip')();
            var zipVendor = new require('node-zip')();
            var zipCommons = new require('node-zip')();

            files.forEach(function(file){

                c++;
                
                var data = fs.readFileSync(dir+file, 'utf8'); //function(err,data){
                    if (err) throw err;


                    if(file === 'bundle.js' /*|| file === 'bundle.js.map' || file === 'manifest.json'*/){

                        zipApp.file(file, data);

                    }

                    if(file === 'vendor.js' /*|| file === 'vendor.js.map'*/){

                        zipVendor.file(file, data);

                    }

                    if(file === 'commons.js' /*|| file === 'commons.js.map'*/){

                        zipCommons.file(file, data);

                    }
       

                    if ( 0 === --c) {
                        console.log(file);  //socket.emit('init', {data: data});
                    }
                
               // }); // end of file read
            
            });// end of forEach

            var zDataApp = zipApp.generate({base64: true, compression: 'DEFLATE'});
            var zDataVendor = zipVendor.generate({base64: true, compression: 'DEFLATE'});
            var zDataCommons = zipCommons.generate({base64: true, compression: 'DEFLATE'});

            var conn = new jsforce.Connection({loginUrl : jsForceConfig.url || 'https://login.salesforce.com'});

            // login to the org
            conn.login(jsForceConfig.username, jsForceConfig.password + jsForceConfig.token, function (err, res) {

                // create you metadata for the static resource
                var metadataApp = {
                    fullName: assetName,
                    content: zDataApp,
                    contentType: 'application/zip',
                    cacheControl: 'Private'
                };

                var metadataVendor = {
                    fullName: 'vendor',
                    content: zDataVendor,
                    contentType: 'application/zip',
                    cacheControl: 'Private'
                };

                 var metadataCommons = {
                    fullName: 'commons',
                    content: zDataCommons,
                    contentType: 'application/zip',
                    cacheControl: 'Private'
                };

               var metaDataPayload = [];
                metaDataPayload.push(metadataApp);
                metaDataPayload.push(metadataVendor);
                metaDataPayload.push(metadataCommons);


                // upsert to resource
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
  
        }); // end of directory read

        /*var zip = new require('node-zip')();

        zip.file("vendor.js", data);


         // read the commons.js file and pass the data to the zip module
        // this is a global asset
        fs.readFile(this.options.resourcePath, function (err, data) {

            if (err) { throw err; }

            // create a zip out of the bundle.js
            var zip = new require('node-zip')();

            zip.file("vendor.js", data);
            zip.file("vendor.js.map", data);

            var zData = zip.generate({base64: true, compression: 'DEFLATE'});

            // define the connection and endpoint
            var conn = new jsforce.Connection({loginUrl : 'https://login.salesforce.com'});

            // login to the org
            conn.login(jsForceConfig.username, jsForceConfig.password + jsForceConfig.token, function (err, res) {

                // create you metadata for the static resource
                var metadata = [{
                    fullName: 'vendor',
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
                            console.log('The Static Resouce: vendor was updated!');

                        } else {

                            console.log(results);

                        }

                    }

                }); // end of upsert

            }); // end of login

        }); // end of readFile*/


        // read the bundle.js file and pass the data to the zip module
        // this is page specific
        /*fs.readFile(this.options.resourcePath, function (err, data2) {

            if (err) { throw err; }

            // create a zip out of the bundle.js
            var zip = new require('node-zip')();

            /*zip.file("vendor.bundle.js", data);
            zip.file("vendor.bundle.js.map", data);
            zip.file("bundle.js", data2);
            zip.file("bundle.js.map", data2);
            zip.file("commons.js", data);
            zip.file("commons.js.map", data);
            zip.file("manifest.json", data);

            var zData2 = zip.generate({base64: true, compression: 'DEFLATE'});


            // define the connection and endpoint
            var conn2 = new jsforce.Connection({loginUrl : 'https://login.salesforce.com'});

            // login to the org
            conn2.login(jsForceConfig.username, jsForceConfig.password + jsForceConfig.token, function (err, res) {

                // create you metadata for the static resource
                var metadata = [{
                    fullName: assetName,
                    content: zData2,
                    contentType: 'application/zip',
                    cacheControl: 'Private'
                }];

                // upsert to resource
                conn2.metadata.upsert('StaticResource', metadata, function (err, results) {
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

        }); // end of readFile*/

       /* // read the commons.js file and pass the data to the zip module
        // this is a global asset
        fs.readFile(this.options.resourcePath, function (err, data) {

            if (err) { throw err; }

            // create a zip out of the bundle.js
            var zip = new require('node-zip')();

            zip.file("commons.js", data);
            zip.file("commons.js.map", data);

            var zData = zip.generate({base64: true, compression: 'DEFLATE'});

            // define the connection and endpoint
            var conn = new jsforce.Connection({loginUrl : 'https://login.salesforce.com'});

            // login to the org
            conn.login(jsForceConfig.username, jsForceConfig.password + jsForceConfig.token, function (err, res) {

                // create you metadata for the static resource
                var metadata = [{
                    fullName: 'commons',
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
                            console.log('The Static Resouce: commons was updated!');

                        } else {

                            console.log(results);

                        }

                    }

                }); // end of upsert

            }); // end of login

        }); // end of readFile*/

       


    }

};

WebpackSalesforceDeployPlugin.prototype.apply = function (compiler) {

    compiler.plugin('done', this.triggerDeploy.bind(this));

};
