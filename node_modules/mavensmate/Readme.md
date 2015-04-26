# [MavensMate](http://mavensmate.com) - Open Source IDEs for Salesforce1

MavensMate is a powerful Node.js application and command line interface for building Salesforce1 IDEs. Develop Salesforce1 applications in your favorite text editors, like Sublime Text and Atom. MavensMate is created and maintained by [Joe Ferraro](http://twitter.com/joeferraro).

For more information, check out [http://mavensmate.com](http://mavensmate.com)!

**IMPORTANT: the core MavensMate API has undergone a major rewrite for stability and performance. This README is changing rapidly!**

- [MavensMate API](#mavensmate-api)
- [MavensMate Plugins](#active-plugins)
- [Bugs and Feature Requests](#bugs-and-feature-requests)
- [Documentation](#documentation)

[![Circle CI](https://circleci.com/gh/joeferraro/MavensMate.png?style=shield)](https://circleci.com/gh/joeferraro/MavensMate)

[![NPM Version](https://img.shields.io/npm/v/mavensmate.svg)](https://www.npmjs.org/package/mavensmate)
[![NPM Downloads](https://img.shields.io/npm/dm/mavensmate.svg?style=flat)](https://www.npmjs.org/package/mavensmate)
[![Coverage Status](https://coveralls.io/repos/joeferraro/MavensMate/badge.svg?branch=master)](https://coveralls.io/r/joeferraro/MavensMate?branch=master)


[![License](https://img.shields.io/npm/l/mavensmate.svg)](https://www.npmjs.org/package/mavensmate)

## MavensMate API

You can build Salesforce1 IDEs by integrating with the APIs exposed in this project. For Node.js projects, you can simply `require('mavensmate')`. For other types of projects, you may use the command line interface (see below, full documentation forthcoming).

### Node.js Projects

To use MavensMate to build a Salesforce1 IDE for your Node.js project:

#### Install

`npm install mavensmate -g`

#### Usage

##### Node Application

```
var mavensmate = require('mavensmate');
var client = mavensmate.createClient({
	editor: '<editor_name>', // supported editor names: atom, sublime
	headless: true,
	verbose: true
});
client.setProject('path/to/some/project', function(err, response) {
	client.executeCommand('compile-project', function(err, response) {
		// full list of commands can be found in lib/mavensmate/commands
	});
});
```

##### Command Line

`mavensmate <command>`

###### Examples

```

mavensmate new-project <<< '{ "name" : "myproject", "workspace" : "/path/to/workspace", "username" : "foo@bar.com", "password" : "foo", package: { "ApexClass" : "*" } }'

cd path/to/workspace/myproject

mavensmate edit-project <<< '{ "package" : { "ApexClass": [ "MyTestClass", "MyTestClass2" ], "ApexPage": "*" } }'

mavensmate update-creds foo@bar.com myPassword123!

mavensmate clean-project

mavensmate compile-project

mavensmate compile-metadata path/to/MyTestClass.cls

mavensmate delete-metadata path/to/MyPage.page

mavensmate start-logging

mavensmate run-tests path/to/MyTestClass.cls

mavensmate run-tests <<< '{ "paths" : [ "/path/to/MyTestClass.cls", "/path/to/MyTestClass2.cls" ] }'

mavensmate get-coverage path/to/MyTestClass.cls

mavensmate get-coverage --global

mavensmate stop-logging

mavensmate new-resource-bundle path/to/my/static/resource

mavensmate deploy-resource-bundle path/to/my/resource/bundle

mavensmate new-connection anotherOrg@somewhere.com coolPassword!

mavensmate deploy --ui

```

For a full list of commands, see the `lib/mavensmate/commands` directory. We will continue to build out this documentation with a full list of commands, including payload parameters.

#### Run Functional/Unit Tests

You must set the following environment variables before running tests:

`SALESFORCE_USERNAME`

`SALESFORCE_PASSWORD`

For verbose logging while running tests, set `MAVENSMATE_DEBUG_TESTS` to `true`

To run all unit and functional tests:

`npm test`

To run a specific test you may use the mocha command line interface. Examples:

`mocha --recursive --grep clean-project`

`mocha --recursive --grep 'index-metadata|project-unit'`


To generate a coverage report, which will be located at test/coverage.html:

`make coverage`

## Active Plugins

### [MavensMate for Sublime Text][stp]

MavensMate for Sublime Text is a Sublime Text plugin that uses the `mm` command line tool to provide a rich IDE experience in the editor. The bulk of the MM for ST codebase is used focused on integration with the Sublime Text APIs. The interaction with the Force.com APIs are still handled by `mm`.

**IMPORTANT:** MavensMate for Sublime Text will eventually be ported to use the APIs in this project.

### [MavensMate for Atom (beta)][atom]

MavensMate for Atom is still in active development. If you're interested in beta-testing the plugin, you are encouraged to install it.


## Bugs and feature requests

Have a bug or a feature request? If it's specific to the MavensMate core, [please open a new issue](https://github.com/joeferraro/mavensmate/issues). Before opening any issue, please search for existing issues.

If you have an issue with the Sublime Text or Atom plugin specifically, please open an issue at the proper project.

**Always include your MavensMate version number, platform, and specific steps to reproduce.**

## Documentation

MavensMate's documentation is built with [Daux.io](http://daux.io) and publicly available on [http://mavensmate.com][docs].

<img src="http://cdn.mavensconsulting.com/mavensmate/img/mm-bg.jpg"/>

[mmcom]: http://mavensmate.com/?utm_source=github&utm_medium=mavensmate&utm_campaign=api
[docs]: http://mavensmate.com/Getting_Started/Developers
[stp]: https://github.com/joeferraro/MavensMate-SublimeText
[atom]: https://github.com/joeferraro/MavensMate-Atom
[mmgithub]: https://github.com/joeferraro/mm
