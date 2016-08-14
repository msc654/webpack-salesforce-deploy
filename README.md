# Webpack Salesforce Deploy Plugin

## First time setup steps.

- In most use cases this plugin is a part of a spa or Webpack build.
- Because it is designed to work with Salesforce it requires an external config file to hold the Salesforce credentials.

#### Step 1: Create the ``jsforce.config.js`` file in the parent folder of you spa or app.

```
module.exports = {

    username: '<Salesforce UserName>',
    password: '<Salesforce Password>',
    token: '<Salesforce Token>',
    url: 'https://login.salesforce.com'

};
 ```


- Make sure to update the name and update the file with your Org credentials.

```
parentFolder --
    app1_Folder --
        webpack.config.js
    app2_Folder --
        webpack.config.js
    jsforce.config.js

 ```

 - In the example above each app folder is a separate Webpack build. The `jsforce.confog.js` provides credentials for both apps.

#### Step 2: Add the plugin reference to your `webpack.config.js` file.

```
var path = require('path');
var WebpackSalesforceDeployPlugin = require('webpack-salesforce-deploy-plugin');

module.exports = {
    devtool: 'eval-source-map',
    context: __dirname + '/app',
    entry: {
        app: './index.js'
    },
    plugins: [
        new WebpackSalesforceDeployPlugin({
            jsConfigPath: __dirname + '/../jsforce.config.js',
            resourcePath: __dirname + '/../../resource-bundles/' + path.basename(__dirname) + '.resource/bundle.js',
            resourceFolderPath: __dirname + '/../../resource-bundles/' + path.basename(__dirname) + '.resource/',
            assetName: path.basename(__dirname)
        })
    ],
    output: {
        path: '../../resource-bundles/<YourStaticResourceName>.resource',
        filename: 'bundle.js'
    },
    ...
 ```

  - This plugin takes the `bundle.js` output of webpack, zips the content and deploys to the Salesforce Org referenced in the `jsforce.config.js`.
  - If there is an error in the build it will not deploy.
  - make sure to update to `<YourStaticResourceName>` to the intended name of your static resource.

