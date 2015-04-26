// not being used currently

module.exports = function(grunt) {
  'use strict';

  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-release');
  grunt.loadNpmTasks('grunt-mocha-cli');

  grunt.initConfig({
    mochacli: {
      options: {
          // require: ['should'],
          reporter: 'spec',
          bail: true
      },
      all: ['test/**/*.js']
    }
    // release: {
    //   options: {
    //     // changelog: 'test/fixtures/_CHANGELOG.md',
    //     // changelogText: '### <%= version %>\n',
    //     github: {
    //       repo: 'joeferraro/MavensMate',
    //       usernameVar: 'GITHUB_USERNAME',
    //       passwordVar: 'GITHUB_PASSWORD'
    //     }
    //   }
    // },
    // mochaTest: {
    //   test: {
    //     options: {
    //       // reporter: 'spec',
    //       // require: 'test/coverage/blanket',
    //       // captureFile: 'results.txt', // Optionally capture the reporter output to a file
    //       // quiet: false, // Optionally suppress output to standard out (defaults to false)
    //       // clearRequireCache: false // Optionally clear the require cache before running tests (defaults to false)
    //     },
    //     src: ['test/**/*.js']
    //   },
    //   // coverage: {
    //   //   options: {
    //   //     reporter: 'html-cov',
    //   //     // use the quiet flag to suppress the mocha console output
    //   //     quiet: true,
    //   //     // specify a destination file to capture the mocha
    //   //     // output (the quiet option does not suppress this)
    //   //     captureFile: 'coverage.html'
    //   //   },
    //   //   src: ['test/**/*.js']
    //   // }
    // }
  });

  // grunt.registerTask('test', 'mochaTest');
  grunt.registerTask('test', 'mochacli');
};