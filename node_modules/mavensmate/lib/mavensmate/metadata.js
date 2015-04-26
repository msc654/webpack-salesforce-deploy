'use strict';
var _               = require('lodash');
var fs              = require('fs-extra');
var path            = require('path');
var util            = require('./util').instance;
var logger          = require('winston');
// var MavensMateFile  = require('./file').MavensMateFile;

var LightningBundle, MetadataHelper;

/**
 * Represents an element of Salesforce.com metadata
 * @constructor
 * @param {Project} project - project instance
 * @param {String} path - path to lightning bundle
 */
LightningBundle = function(path, project) {
  this.project = project;
  this.path = path;
};

// Object.defineProperty(LightningBundle.prototype, 'bundleItems', {
//   get: function() {
//     var self = this;
//     var bundleFiles = [];
//     var bfs = fs.readdirSync(self.path);
//     _.each(bfs, function(bf) {
//       bundleFiles.push(new MavensMateFile({ project: self.project, path: bf }));
//     });
//   }
// });

Object.defineProperty(LightningBundle.prototype, 'serverContents', {
  get: function() {
    // TODO
  }
});

MetadataHelper = function(opts) {
  util.applyProperties(this, opts);
  if (this.sfdcClient) {
    if (this.sfdcClient.describeCache && this.sfdcClient.describeCache.metadataObjects) {
      this.describe = this.sfdcClient.describeCache;
    } else {
      this.describe = {};
      this.describe.metadataObjects = this.parentTypes;
    }
  } else {
    this.describe = {};
    this.describe.metadataObjects = this.parentTypes;
  }
};

/**
 * Attempts to get the metadata type based on the supplied path (could be file path or directory path)
 * @param  {String} p - /path/to/some/metadata.foo
 * @return {Object}
 */
MetadataHelper.prototype.getTypeByPath = function(p) {
  var parentPath = path.dirname(p);
  var grandparentPath = path.dirname(path.dirname(p));
  if (!path.extname(p) && path.basename(parentPath) === 'aura') {
    return this.getTypeByDirectoryName('aura');
  } else if (path.basename(grandparentPath) === 'aura') {
    return this.getTypeByDirectoryName('aura');
  } else {    
    var folderBasedTypes = _.where(this.parentTypes, { 'inFolder': true });

    // directory handling
    if (!path.extname(p)) {
      
      // foo/bar/src/classes
      var directoryMatch = _.find(this.parentTypes, { 'directoryName': path.basename(p) });
      if (directoryMatch) {
        return this.getTypeByDirectoryName(path.basename(p)); 
      }

      //foo/bar/src/reports/myreportfolder
      var parentFolderDirectoryMatch = _.find(folderBasedTypes, { 'directoryName': path.basename(parentPath) });
      if (parentFolderDirectoryMatch) {
        return this.getTypeByDirectoryName(path.basename(parentPath)); 
      }
    }

    var ext;
    if (util.endsWith(p, '-meta.xml')) {
      ext = p.replace('-meta.xml', '').split('.').pop();
    } else {
      ext = p.split('.').pop();
    }
    var typeBySuffix = this.getTypeBySuffix(ext); 
    if (typeBySuffix) {
      return typeBySuffix;
    }

    //deeply-nested file handling (report/email template/document)
    //foo/bar/src/email/myfolder/foo.email
    var grandparentFolderDirectoryMatch = _.find(folderBasedTypes, { 'directoryName': path.basename(grandparentPath) });
    if (grandparentFolderDirectoryMatch) {
      return this.getTypeByDirectoryName(path.basename(grandparentPath)); 
    }

    // email templates, for example, will have a -meta.xml file that holds folder metadata
    if (util.endsWith(p, '-meta.xml')) {
      return this.getTypeByDirectoryName(path.basename(parentPath)); 
    }
  }
};

/**
 * Gets metadata type based on the supplied name
 * @param  {String} name - ApexClass|ApexPage|etc.
 * @return {Object}
 */
MetadataHelper.prototype.getTypeByXmlName = function(name) {
  var type;
  var self = this;
  _.each(self.describe.metadataObjects, function(metadataType) {
    if (metadataType.xmlName === name) {
      type = metadataType;
      return false;
    }
  });
  if (!type) {
    _.each(self.childTypes, function(childType) {
      if (childType.xmlName === name) {
        type = childType;
        return false;
      }
    });  
  }
  if (!type) {
    _.each(self.parentTypes, function(parentType) {
      if (parentType.xmlName === name) {
        type = parentType;
        return false;
      }
    });  
  }
  logger.debug('getting metadata type by name: '+name);
  logger.debug(type);
  return type;
};

/**
 * Gets metadata type based on the supplied suffix
 * @param  {String} suffix - cls|trigger|page|component|etc.
 * @return {Object}
 */
MetadataHelper.prototype.getTypeBySuffix = function(suffix) {
  var type;
  var self = this;
  if (suffix.indexOf('.') >= 0) {
    suffix = suffix.replace(/\./g, '');
  }
  _.each(self.describe.metadataObjects, function(metadataType) {
    if (metadataType.suffix === suffix) {
      type = metadataType;
      return false;
    }
  });
  return type;
};

/**
 * Gets metadata type based on the supplied directory name
 * @param  {String} suffix - pages|triggers|classes|etc.
 * @return {Object}
 */
MetadataHelper.prototype.getTypeByDirectoryName = function(dirName) {
  var type;
  var self = this;
  _.each(self.describe.metadataObjects, function(metadataType) {
    if (metadataType.directoryName === dirName) {
      type = metadataType;
      return false;
    }
  });
  if (type === undefined) {
    _.each(self.parentTypes, function(parentType) {
      if (parentType.directoryName === dirName) {
        type = parentType;
        return false;
      }
    });  
  }
  return type;
};

MetadataHelper.prototype.childTypes = [
    {'xmlName' : 'CustomField', 'tagName' : 'fields', 'parentXmlName' : 'CustomObject' }, 
    {'xmlName' : 'BusinessProcess', 'tagName' : 'businessProcesses', 'parentXmlName' : 'CustomObject' }, 
    {'xmlName' : 'RecordType', 'tagName' : 'recordTypes', 'parentXmlName' : 'CustomObject' }, 
    {'xmlName' : 'WebLink', 'tagName' : 'webLinks', 'parentXmlName' : 'CustomObject' }, 
    {'xmlName' : 'ValidationRule', 'tagName' : 'validationRules', 'parentXmlName' : 'CustomObject' }, 
    {'xmlName' : 'NamedFilter', 'tagName' : 'namedFilters', 'parentXmlName' : 'CustomObject' }, 
    {'xmlName' : 'SharingReason', 'tagName' : 'sharingReasons', 'parentXmlName' : 'CustomObject' }, 
    {'xmlName' : 'ListView', 'tagName' : 'listViews', 'parentXmlName' : 'CustomObject' }, 
    {'xmlName' : 'FieldSet', 'tagName' : 'fieldSets', 'parentXmlName' : 'CustomObject' },
    {'xmlName' : 'CustomLabel', 'tagName' : 'customLabels', 'parentXmlName' : 'CustomLabels' },
    {'xmlName' : 'WorkflowAlert', 'tagName' : 'alerts', 'parentXmlName' : 'Workflow' },
    {'xmlName' : 'WorkflowTask', 'tagName' : 'tasks', 'parentXmlName' : 'Workflow' },
    {'xmlName' : 'WorkflowOutboundMessage', 'tagName' : 'outboundMessages', 'parentXmlName' : 'Workflow' },
    {'xmlName' : 'WorkflowFieldUpdate', 'tagName' : 'fieldUpdates', 'parentXmlName' : 'Workflow' },
    {'xmlName' : 'WorkflowRule', 'tagName' : 'rules', 'parentXmlName' : 'WorkFlow' }, 
    {'xmlName' : 'WorkflowEmailRecipient', 'tagName' : 'emailRecipients', 'parentXmlName' : 'Workflow' },
    {'xmlName' : 'WorkflowTimeTrigger', 'tagName' : 'timeTriggers', 'parentXmlName' : 'Workflow' },
    {'xmlName' : 'WorkflowActionReference', 'tagName' : 'actionReferences', 'parentXmlName' : 'Workflow' }
];

MetadataHelper.prototype.parentTypes = [
    {
        'directoryName': 'installedPackages', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'installedPackage', 
        'xmlName': 'InstalledPackage'
    }, 
    {
        'childXmlNames': 'CustomLabel', 
        'directoryName': 'labels', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'labels', 
        'xmlName': 'CustomLabels'
    }, 
    {
        'directoryName': 'staticresources', 
        'inFolder': false, 
        'metaFile': true, 
        'suffix': 'resource', 
        'xmlName': 'StaticResource'
    }, 
    {
        'directoryName': 'scontrols', 
        'inFolder': false, 
        'metaFile': true, 
        'suffix': 'scf', 
        'xmlName': 'Scontrol'
    }, 
    {
        'directoryName': 'components', 
        'inFolder': false, 
        'metaFile': true, 
        'suffix': 'component', 
        'xmlName': 'ApexComponent'
    }, 
    {
        'directoryName': 'pages', 
        'inFolder': false, 
        'metaFile': true, 
        'suffix': 'page', 
        'xmlName': 'ApexPage'
    }, 
    {
        'directoryName': 'queues', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'queue', 
        'xmlName': 'Queue'
    }, 
    {
        'childXmlNames': [
            'CustomField', 
            'BusinessProcess', 
            'CompactLayout', 
            'RecordType', 
            'WebLink', 
            'ValidationRule', 
            'NamedFilter', 
            'SharingReason', 
            'ListView', 
            'FieldSet', 
            'ApexTriggerCoupling'
        ], 
        'directoryName': 'objects', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'object', 
        'xmlName': 'CustomObject'
    }, 
    {
        'directoryName': 'reportTypes', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'reportType', 
        'xmlName': 'ReportType'
    }, 
    {
        'directoryName': 'reports', 
        'inFolder': true, 
        'metaFile': false, 
        'suffix': 'report', 
        'xmlName': 'Report'
    }, 
    {
        'directoryName': 'dashboards', 
        'inFolder': true, 
        'metaFile': false, 
        'suffix': 'dashboard', 
        'xmlName': 'Dashboard'
    }, 
    {
        'directoryName': 'analyticSnapshots', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'snapshot', 
        'xmlName': 'AnalyticSnapshot'
    }, 
    {
        'directoryName': 'layouts', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'layout', 
        'xmlName': 'Layout'
    }, 
    {
        'directoryName': 'portals', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'portal', 
        'xmlName': 'Portal'
    }, 
    {
        'directoryName': 'documents', 
        'inFolder': true, 
        'metaFile': true, 
        'xmlName': 'Document'
    }, 
    {
        'directoryName': 'weblinks', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'weblink', 
        'xmlName': 'CustomPageWebLink'
    }, 
    {
        'directoryName': 'quickActions', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'quickAction', 
        'xmlName': 'QuickAction'
    }, 
    {
        'childXmlNames': {
            '@xsi:nil': 'true'
        }, 
        'directoryName': 'flexipages', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'flexipage', 
        'xmlName': 'FlexiPage'
    }, 
    {
        'directoryName': 'tabs', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'tab', 
        'xmlName': 'CustomTab'
    }, 
    {
        'directoryName': 'customApplicationComponents', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'customApplicationComponent', 
        'xmlName': 'CustomApplicationComponent'
    }, 
    {
        'directoryName': 'applications', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'app', 
        'xmlName': 'CustomApplication'
    }, 
    {
        'directoryName': 'letterhead', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'letter', 
        'xmlName': 'Letterhead'
    }, 
    {
        'directoryName': 'email', 
        'inFolder': true, 
        'metaFile': true, 
        'suffix': 'email', 
        'xmlName': 'EmailTemplate'
    }, 
    {
        'childXmlNames': [
            'WorkflowFieldUpdate', 
            'WorkflowKnowledgePublish', 
            'WorkflowQuickCreate', 
            'WorkflowTask', 
            'WorkflowChatterPost', 
            'WorkflowAlert', 
            'WorkflowSend', 
            'WorkflowOutboundMessage', 
            'WorkflowActionFlow', 
            'WorkflowApex', 
            'WorkflowRule', 
            {
                '@xsi:nil': 'true'
            }
        ], 
        'directoryName': 'workflows', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'workflow', 
        'xmlName': 'Workflow'
    }, 
    {
        'childXmlNames': 'AssignmentRule', 
        'directoryName': 'assignmentRules', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'assignmentRules', 
        'xmlName': 'AssignmentRules'
    }, 
    {
        'childXmlNames': 'AutoResponseRule', 
        'directoryName': 'autoResponseRules', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'autoResponseRules', 
        'xmlName': 'AutoResponseRules'
    }, 
    {
        'childXmlNames': 'EscalationRule', 
        'directoryName': 'escalationRules', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'escalationRules', 
        'xmlName': 'EscalationRules'
    }, 
    {
        'directoryName': 'roles', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'role', 
        'xmlName': 'Role'
    }, 
    {
        'directoryName': 'groups', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'group', 
        'xmlName': 'Group'
    }, 
    {
        'directoryName': 'postTemplates', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'postTemplate', 
        'xmlName': 'PostTemplate'
    }, 
    {
        'directoryName': 'approvalProcesses', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'approvalProcess', 
        'xmlName': 'ApprovalProcess'
    }, 
    {
        'directoryName': 'homePageComponents', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'homePageComponent', 
        'xmlName': 'HomePageComponent'
    }, 
    {
        'directoryName': 'homePageLayouts', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'homePageLayout', 
        'xmlName': 'HomePageLayout'
    }, 
    {
        'directoryName': 'objectTranslations', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'objectTranslation', 
        'xmlName': 'CustomObjectTranslation'
    }, 
    {
        'directoryName': 'flows', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'flow', 
        'xmlName': 'Flow'
    }, 
    {
        'directoryName': 'classes', 
        'inFolder': false, 
        'metaFile': true, 
        'suffix': 'cls', 
        'xmlName': 'ApexClass'
    }, 
    {
        'directoryName': 'triggers', 
        'inFolder': false, 
        'metaFile': true, 
        'suffix': 'trigger', 
        'xmlName': 'ApexTrigger'
    }, 
    {
        'directoryName': 'profiles', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'profile', 
        'xmlName': 'Profile'
    }, 
    {
        'directoryName': 'permissionsets', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'permissionset', 
        'xmlName': 'PermissionSet'
    }, 
    {
        'directoryName': 'datacategorygroups', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'datacategorygroup', 
        'xmlName': 'DataCategoryGroup'
    }, 
    {
        'directoryName': 'remoteSiteSettings', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'remoteSite', 
        'xmlName': 'RemoteSiteSetting'
    }, 
    {
        'directoryName': 'authproviders', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'authprovider', 
        'xmlName': 'AuthProvider'
    }, 
    {
        'childXmlNames': [
            'LeadOwnerSharingRule', 
            'LeadCriteriaBasedSharingRule'
        ], 
        'directoryName': 'leadSharingRules', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'sharingRules', 
        'xmlName': 'LeadSharingRules'
    }, 
    {
        'childXmlNames': [
            'CampaignOwnerSharingRule', 
            'CampaignCriteriaBasedSharingRule'
        ], 
        'directoryName': 'campaignSharingRules', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'sharingRules', 
        'xmlName': 'CampaignSharingRules'
    }, 
    {
        'childXmlNames': [
            'CaseOwnerSharingRule', 
            'CaseCriteriaBasedSharingRule'
        ], 
        'directoryName': 'caseSharingRules', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'sharingRules', 
        'xmlName': 'CaseSharingRules'
    }, 
    {
        'childXmlNames': [
            'ContactOwnerSharingRule', 
            'ContactCriteriaBasedSharingRule'
        ], 
        'directoryName': 'contactSharingRules', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'sharingRules', 
        'xmlName': 'ContactSharingRules'
    }, 
    {
        'childXmlNames': [
            'OpportunityOwnerSharingRule', 
            'OpportunityCriteriaBasedSharingRule'
        ], 
        'directoryName': 'opportunitySharingRules', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'sharingRules', 
        'xmlName': 'OpportunitySharingRules'
    }, 
    {
        'childXmlNames': [
            'AccountOwnerSharingRule', 
            'AccountCriteriaBasedSharingRule'
        ], 
        'directoryName': 'accountSharingRules', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'sharingRules', 
        'xmlName': 'AccountSharingRules'
    }, 
    {
        'childXmlNames': [
            'CustomObjectOwnerSharingRule', 
            'CustomObjectCriteriaBasedSharingRule'
        ], 
        'directoryName': 'customObjectSharingRules', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'sharingRules', 
        'xmlName': 'CustomObjectSharingRules'
    }, 
    {
        'directoryName': 'communities', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'community', 
        'xmlName': 'Community'
    }, 
    {
        'directoryName': 'callCenters', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'callCenter', 
        'xmlName': 'CallCenter'
    }, 
    {
        'directoryName': 'connectedApps', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'connectedApp', 
        'xmlName': 'ConnectedApp'
    }, 
    {
        'directoryName': 'samlssoconfigs', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'samlssoconfig', 
        'xmlName': 'SamlSsoConfig'
    }, 
    {
        'directoryName': 'synonymDictionaries', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'synonymDictionary', 
        'xmlName': 'SynonymDictionary'
    }, 
    {
        'directoryName': 'settings', 
        'inFolder': false, 
        'metaFile': false, 
        'suffix': 'settings', 
        'xmlName': 'Settings'
    },
    {
      'directoryName': 'aura',
      'inFolder': false,
      'metaFile': false,
      'xmlName': 'AuraDefinitionBundle'
    }
];

MetadataHelper.prototype.inFolderDirectoryNames = function() {
  var directoryNames = [];
  var self = this;
  var parentTypes = (self.describe.metadataObjects && self.describe.metadataObjects.length > 0) ? self.describe.metadataObjects : self.parentTypes;
  _.each(parentTypes, function(metadataType) {
    if (metadataType.inFolder) {
      directoryNames.push(metadataType.directoryName);
    }
  });
  return directoryNames;
};

module.exports.LightningBundle = LightningBundle;
module.exports.MetadataHelper = MetadataHelper;