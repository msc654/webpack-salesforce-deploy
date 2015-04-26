// 'use strict';

// var _ 						= require('lodash');
// var helper 				= require('../test-helper');
// var chai 					= require('chai');
// var should 				= chai.should();
// var IndexService 	= require('../../lib/mavensmate/index');

// describe('mavensmate local-store', function(){

// 	it.only('should add new metadata to the store when created on the server', function(done) {
// 		this.timeout(10000);

// 		var testClient = helper.createClient('atom');

// 		helper.setProject(testClient, 'existing-project', function() {
// 			testClient.getProject().getOrgMetadataIndexWithSelections()
// 				.then(function(m) {
// 					var apexClass = _.find(m, {id:'ApexClass'});
// 					apexClass.select.should.equal(true);
// 					done();
// 				});
// 		});
	
// 	});

// 	it('should remove metadata from the store when metadata is deleted from the server', function(done) {
		
// 	});

// 	it('should update the store when metadata is refreshed from the server', function(done) {
		
// 	});

// });

