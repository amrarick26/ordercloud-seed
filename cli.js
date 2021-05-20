#!/usr/bin/env node
'use strict';

var yargs = require('yargs');
var axios = require('axios');
var qs = require('qs');
var ordercloudJavascriptSdk = require('ordercloud-javascript-sdk');
var fs = require('fs');
var yaml = require('js-yaml');
var chalk = require('chalk');
var emoji = require('node-emoji');
var _ = require('lodash');
var jwt_decode = require('jwt-decode');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var yargs__default = /*#__PURE__*/_interopDefaultLegacy(yargs);
var axios__default = /*#__PURE__*/_interopDefaultLegacy(axios);
var qs__default = /*#__PURE__*/_interopDefaultLegacy(qs);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var yaml__default = /*#__PURE__*/_interopDefaultLegacy(yaml);
var chalk__default = /*#__PURE__*/_interopDefaultLegacy(chalk);
var emoji__default = /*#__PURE__*/_interopDefaultLegacy(emoji);
var ___default = /*#__PURE__*/_interopDefaultLegacy(_);
var jwt_decode__default = /*#__PURE__*/_interopDefaultLegacy(jwt_decode);

class Portal {
    static async login(username, password) {
        var response = await axios__default['default'].post(`${this.baseUrl}/oauth/token`, qs__default['default'].stringify({
            grant_type: "password",
            username: username,
            password: password
        }), {
            headers: {
                'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
            }
        });
        return response.data.access_token;
    }
    static async getOrganizationToken(orgID, portalToken) {
        var response = await axios__default['default'].get(`${this.baseUrl}/organizations/${orgID}/token`, {
            headers: {
                'Authorization': `Bearer ${portalToken}`
            }
        });
        return response.data.access_token;
    }
    static async CreateOrganization(org, portalToken) {
        await axios__default['default'].put(`${this.baseUrl}/organizations/${org.Id}`, org, {
            headers: {
                'Authorization': `Bearer ${portalToken}`
            }
        });
    }
}
Portal.baseUrl = "https://portal.ordercloud.io/api/v1";

function log(message, messageType = MessageType.Progress) {
    if (messageType == MessageType.Success) {
        console.log(emoji__default['default'].get('heavy_check_mark'), chalk__default['default'].green(' SUCCESS -', message));
    }
    if (messageType == MessageType.Error) {
        console.log(emoji__default['default'].get('x'), chalk__default['default'].red('ERROR -', message));
    }
    if (messageType == MessageType.Progress) {
        console.log(emoji__default['default'].get('clock1'), 'PROGRESS -', message);
    }
}
var MessageType;
(function (MessageType) {
    MessageType[MessageType["Error"] = 0] = "Error";
    MessageType[MessageType["Progress"] = 1] = "Progress";
    MessageType[MessageType["Success"] = 2] = "Success";
})(MessageType || (MessageType = {}));

class SeedFile {
    constructor() {
        this.file = {
            Objects: {},
            Assignments: {}
        };
    }
    GetTypeField(resource) {
        return resource.isAssignment ? "Assignments" : "Objects";
    }
    AddRecords(resource, records) {
        var typeField = this.GetTypeField(resource);
        this.file[typeField][resource.name] = this.file[typeField][resource.name] || [];
        this.file[typeField][resource.name].push(...records);
    }
    GetRecords(resource) {
        var _a, _b;
        var typeField = this.GetTypeField(resource);
        return ((_b = (_a = this.file) === null || _a === void 0 ? void 0 : _a[typeField]) === null || _b === void 0 ? void 0 : _b[resource.name]) || [];
    }
    WriteToYaml(filePath) {
        fs__default['default'].writeFileSync(filePath, yaml__default['default'].dump(this.file));
    }
    ReadFromYaml(filePath, errors) {
        var file;
        try {
            file = fs__default['default'].readFileSync(filePath, 'utf8'); // consider switching to streams
            log(`Found file \"${filePath}\"`, MessageType.Success);
        }
        catch (err) {
            errors.push(`No such file or directory \"${filePath}\" found`);
            return false;
        }
        try {
            this.file = yaml__default['default'].load(file);
            log(`Valid yaml in \"${filePath}\"`, MessageType.Success);
        }
        catch (e) {
            var ex = e;
            errors.push(`YAML Exception in \"${filePath}\": ${ex.message}`);
            return false;
        }
        return true;
    }
}

const { chunk } = ___default['default'];
// Its not equivalent to the C# throttler. With some work it could be though.
async function RunThrottled(items, maxParallelism, asyncAction) {
    let results = [];
    const batches = chunk(items, maxParallelism);
    for (let batch of batches) {
        const batchResults = await Promise.all(batch.map(asyncAction));
        results = results.concat(batchResults);
    }
    return results;
}

const { flatten, range } = ___default['default'];
class OrderCloudBulk {
    static async ListAll(resource, ...routeParams) {
        const listFunc = resource.sdkObject[resource.listMethodName];
        const page1 = await listFunc(...routeParams, { page: 1, pageSize: 100 });
        const additionalPages = range(2, Math.max((page1 === null || page1 === void 0 ? void 0 : page1.Meta.TotalPages) + 1, 2));
        var results = await RunThrottled(additionalPages, 8, page => listFunc(...routeParams, { page, pageSize: 100 }));
        // combine and flatten items
        return flatten([page1, ...results].map((r) => r.Items));
    }
    static async CreateAll(resource, records, ...routeParams) {
        const createFunc = resource.sdkObject[resource.createMethodName];
        await RunThrottled(records, 8, record => createFunc(...routeParams, record));
    }
}

// strings coorespond to the name of the YAML property for that resource
var OCResourceEnum;
(function (OCResourceEnum) {
    OCResourceEnum["SecurityProfiles"] = "SecurityProfiles";
    OCResourceEnum["ImpersonationConfigs"] = "ImpersonationConfigs";
    OCResourceEnum["OpenIdConnects"] = "OpenIdConnects";
    OCResourceEnum["AdminUsers"] = "AdminUsers";
    OCResourceEnum["AdminUserGroups"] = "AdminUserGroups";
    OCResourceEnum["AdminAddresses"] = "AdminAddresses";
    OCResourceEnum["MessageSenders"] = "MessageSenders";
    OCResourceEnum["ApiClients"] = "ApiClients";
    OCResourceEnum["Incrementors"] = "Incrementors";
    OCResourceEnum["IntegrationEvents"] = "IntegrationEvents";
    OCResourceEnum["Webhooks"] = "Webhooks";
    OCResourceEnum["XpIndices"] = "XpIndices";
    OCResourceEnum["Buyers"] = "Buyers";
    OCResourceEnum["Users"] = "Users";
    OCResourceEnum["UserGroups"] = "UserGroups";
    OCResourceEnum["Addresses"] = "Addresses";
    OCResourceEnum["CostCenters"] = "CostCenters";
    OCResourceEnum["CreditCards"] = "CreditCards";
    OCResourceEnum["SpendingAccounts"] = "SpendingAccounts";
    OCResourceEnum["ApprovalRules"] = "ApprovalRules";
    OCResourceEnum["Suppliers"] = "Suppliers";
    OCResourceEnum["SupplierUsers"] = "SupplierUsers";
    OCResourceEnum["SupplierUserGroups"] = "SupplierUserGroups";
    OCResourceEnum["SupplierAddresses"] = "SupplierAddresses";
    OCResourceEnum["Catalogs"] = "Catalogs";
    OCResourceEnum["Categories"] = "Categories";
    OCResourceEnum["Products"] = "Products";
    OCResourceEnum["PriceSchedules"] = "PriceSchedules";
    OCResourceEnum["Specs"] = "Specs";
    OCResourceEnum["SpecOptions"] = "SpecOptions";
    OCResourceEnum["ProductFacets"] = "ProductFacets";
    OCResourceEnum["Promotions"] = "Promotions";
    OCResourceEnum["SecurityProfileAssignments"] = "SecurityProfileAssignments";
    OCResourceEnum["AdminUserGroupAssignments"] = "AdminUserGroupAssignments";
    OCResourceEnum["ApiClientAssignments"] = "ApiClientAssignments";
    OCResourceEnum["UserGroupAssignments"] = "UserGroupAssignments";
    OCResourceEnum["AddressAssignments"] = "AddressAssignments";
    OCResourceEnum["CostCenterAssignments"] = "CostCenterAssignments";
    OCResourceEnum["CreditCardAssignments"] = "CreditCardAssignments";
    OCResourceEnum["SpendingAccountAssignments"] = "SpendingAccountAssignments";
    OCResourceEnum["SupplierUserGroupsAssignments"] = "SupplierUserGroupsAssignments";
    OCResourceEnum["ProductAssignments"] = "ProductAssignments";
    OCResourceEnum["CatalogAssignments"] = "CatalogAssignments";
    OCResourceEnum["ProductCatalogAssignment"] = "ProductCatalogAssignment";
    OCResourceEnum["CategoryAssignments"] = "CategoryAssignments";
    OCResourceEnum["CategoryProductAssignments"] = "CategoryProductAssignments";
    OCResourceEnum["SpecProductAssignments"] = "SpecProductAssignments";
    OCResourceEnum["PromotionAssignment"] = "PromotionAssignment";
})(OCResourceEnum || (OCResourceEnum = {}));

const ImpersonationConfigValidationFunc = (record, validator) => {
    var impersonationBuyerID = record["ImpersonationBuyerID"];
    var impersonationGroupID = record["ImpersonationGroupID"];
    var impersonationUserID = record["ImpersonationUserID"];
    var hasGroupID = !___default['default'].isNil(impersonationGroupID);
    var hasUserID = !___default['default'].isNil(impersonationUserID);
    if (___default['default'].isNil(impersonationBuyerID)) {
        if (hasGroupID && !validator.idCache.has(OCResourceEnum.AdminUserGroups, impersonationGroupID)) {
            validator.addError(`Invalid reference ImpersonationConfigs.ImpersonationGroupID: no AdminUserGroup found with ID \"${impersonationGroupID}\".`);
        }
        if (hasUserID && !validator.idCache.has(OCResourceEnum.AdminUsers, impersonationUserID)) {
            validator.addError(`Invalid reference ImpersonationConfigs.impersonationUserID: no AdminUser found with ID \"${impersonationUserID}\".`);
        }
    }
    else {
        if (hasGroupID && !validator.idCache.has(OCResourceEnum.UserGroups, `${impersonationBuyerID}/${impersonationGroupID}`)) {
            validator.addError(`Invalid reference ImpersonationConfigs.ImpersonationGroupID: no UserGroup found with ID \"${impersonationGroupID}\" and BuyerID \"${impersonationBuyerID}\".`);
        }
        if (hasUserID && !validator.idCache.has(OCResourceEnum.Users, `${impersonationBuyerID}/${impersonationUserID}`)) {
            validator.addError(`Invalid reference ImpersonationConfigs.impersonationUserID: no User found with ID \"${impersonationUserID}\" and BuyerID \"${impersonationBuyerID}\".`);
        }
    }
};
const ApiClientValidationFunc = (record, validator) => {
    var defaultContextUsername = record["DefaultContextUserName"];
    if (!___default['default'].isNil(defaultContextUsername) && !validator.usernameCache.has(defaultContextUsername)) {
        validator.addError(`Invalid reference ApiClients.DefaultContextUserName: no User, SupplierUser or AdminUser found with Username \"${defaultContextUsername}\".`);
    }
};
const WebhookValidationFunc = (record, validator) => {
    var _a;
    var apiClientIDs = (_a = record["ApiClientIDs"]) !== null && _a !== void 0 ? _a : [];
    var invalidIDs = apiClientIDs.filter(id => !validator.idCache.has(OCResourceEnum.ApiClients, id));
    if (invalidIDs.length !== 0) {
        validator.addError(`Invalid reference Webhooks.ApiClientIDs: could not find ApiClients with IDs ${invalidIDs.join(", ")}.`);
    }
};
const SecurityProfileAssignmentValidationFunc = (record, validator) => {
    var buyerID = record["BuyerID"];
    var supplierID = record["SupplierID"];
    var userID = record["UserID"];
    var groupID = record["UserGroupID"];
    var hasBuyerID = !___default['default'].isNil(buyerID);
    var hasSupplierID = !___default['default'].isNil(supplierID);
    var hasUserID = !___default['default'].isNil(userID);
    var hasGroupID = !___default['default'].isNil(groupID);
    if (hasBuyerID && hasSupplierID) {
        return validator.addError(`SecurityProfileAssignment error: cannot include both a BuyerID and a SupplierID`);
    }
    else if (hasSupplierID) {
        if (hasUserID && !validator.idCache.has(OCResourceEnum.SupplierUsers, `${supplierID}/${userID}`)) {
            validator.addError(`Invalid reference SecurityProfileAssignment.UserID: no SupplierUser found with ID \"${userID}\" and SupplierID \"${supplierID}\".`);
        }
        if (hasGroupID && !validator.idCache.has(OCResourceEnum.SupplierUserGroups, `${supplierID}/${groupID}`)) {
            validator.addError(`Invalid reference SecurityProfileAssignment.UserGroupID: no SupplierUserGroups found with ID \"${groupID}\" and SupplierID \"${supplierID}\".`);
        }
    }
    else if (hasBuyerID) {
        if (hasUserID && !validator.idCache.has(OCResourceEnum.Users, `${buyerID}/${userID}`)) {
            validator.addError(`Invalid reference SecurityProfileAssignment.UserID: no User found with ID \"${userID}\" and BuyerID \"${buyerID}\".`);
        }
        if (hasGroupID && !validator.idCache.has(OCResourceEnum.UserGroups, `${buyerID}/${groupID}`)) {
            validator.addError(`Invalid reference SecurityProfileAssignment.UserGroupID: no UserGroup found with ID \"${groupID}\" and BuyerID \"${buyerID}\".`);
        }
    }
    else {
        if (hasUserID && !validator.idCache.has(OCResourceEnum.AdminUsers, userID)) {
            validator.addError(`Invalid reference SecurityProfileAssignment.UserID: no AdminUser found with ID \"${userID}\".`);
        }
        if (hasGroupID && !validator.idCache.has(OCResourceEnum.AdminUserGroups, groupID)) {
            validator.addError(`Invalid reference SecurityProfileAssignment.UserGroupID: no AdminUserGroup found with ID \"${groupID}\".`);
        }
    }
};

const Directory = [
    {
        name: OCResourceEnum.SecurityProfiles,
        modelName: 'SecurityProfile',
        sdkObject: ordercloudJavascriptSdk.SecurityProfiles,
        createPriority: 2,
        path: "/securityprofiles"
    },
    {
        name: OCResourceEnum.ImpersonationConfigs,
        modelName: 'ImpersonationConfig',
        sdkObject: ordercloudJavascriptSdk.ImpersonationConfigs,
        createPriority: 6,
        path: "/impersonationconfig",
        customValidationFunc: ImpersonationConfigValidationFunc,
        foreignKeys: {
            ClientID: { foreignResource: OCResourceEnum.ApiClients },
            SecurityProfileID: { foreignResource: OCResourceEnum.SecurityProfiles },
            BuyerID: { foreignResource: OCResourceEnum.Buyers },
            GroupID: {
                foreignResource: OCResourceEnum.UserGroups,
                foreignParentRefField: "BuyerID"
            },
            UserID: {
                foreignResource: OCResourceEnum.Users,
                foreignParentRefField: "BuyerID"
            },
            ImpersonationBuyerID: { foreignResource: OCResourceEnum.Buyers },
        }
    },
    {
        name: OCResourceEnum.OpenIdConnects,
        modelName: 'OpenIdConnect',
        sdkObject: ordercloudJavascriptSdk.OpenIdConnects,
        createPriority: 6,
        path: "/openidconnects",
        redactFields: ["ConnectClientSecret"],
        foreignKeys: {
            OrderCloudApiClientID: { foreignResource: OCResourceEnum.ApiClients },
            IntegrationEventID: { foreignResource: OCResourceEnum.IntegrationEvents }
        }
    },
    {
        name: OCResourceEnum.AdminUsers,
        modelName: 'User',
        sdkObject: ordercloudJavascriptSdk.AdminUsers,
        path: "/adminusers",
        createPriority: 2
    },
    {
        name: OCResourceEnum.AdminUserGroups,
        modelName: 'UserGroup',
        sdkObject: ordercloudJavascriptSdk.AdminUserGroups,
        path: "/usergroups",
        createPriority: 2
    },
    {
        name: OCResourceEnum.AdminAddresses,
        modelName: 'Address',
        sdkObject: ordercloudJavascriptSdk.AdminAddresses,
        path: "/addresses",
        createPriority: 2
    },
    {
        name: OCResourceEnum.MessageSenders,
        modelName: 'MessageSender',
        sdkObject: ordercloudJavascriptSdk.MessageSenders,
        path: "/messagesenders",
        createPriority: 2,
        redactFields: ["SharedKey"],
    },
    {
        name: OCResourceEnum.ApiClients,
        modelName: 'ApiClient',
        sdkObject: ordercloudJavascriptSdk.ApiClients,
        createPriority: 5,
        path: "/apiclients",
        redactFields: ["ClientSecret"],
        foreignKeys: {
            IntegrationEventID: { foreignResource: OCResourceEnum.IntegrationEvents }
        },
        downloadTransformFunc: (x) => {
            x.ID = x.ID.toLowerCase(); // funky platform thing with API CLient ID casing
            return x;
        },
        customValidationFunc: ApiClientValidationFunc,
    },
    {
        name: OCResourceEnum.Incrementors,
        modelName: 'Incrementor',
        sdkObject: ordercloudJavascriptSdk.Incrementors,
        path: "/incrementors",
        createPriority: 1
    },
    {
        name: OCResourceEnum.Webhooks,
        modelName: 'Webhook',
        sdkObject: ordercloudJavascriptSdk.Webhooks,
        createPriority: 6,
        path: "/webhooks",
        redactFields: ["HashKey"],
        // for .ApiClientIDs
        customValidationFunc: WebhookValidationFunc
    },
    {
        name: OCResourceEnum.IntegrationEvents,
        modelName: 'IntegrationEvent',
        sdkObject: ordercloudJavascriptSdk.IntegrationEvents,
        path: "/integrationEvents",
        createPriority: 2,
        redactFields: ["HashKey"],
    },
    {
        name: OCResourceEnum.XpIndices,
        modelName: "XpIndex",
        sdkObject: ordercloudJavascriptSdk.XpIndices,
        path: "/xpindices",
        createPriority: 1
    },
    {
        name: OCResourceEnum.Buyers,
        modelName: "Buyer",
        sdkObject: ordercloudJavascriptSdk.Buyers,
        createPriority: 3,
        path: "/buyers",
        foreignKeys: {
            DefaultCatalogID: { foreignResource: OCResourceEnum.Catalogs }
        },
        children: [OCResourceEnum.Users, OCResourceEnum.UserGroups, OCResourceEnum.Addresses, OCResourceEnum.CostCenters, OCResourceEnum.CreditCards, OCResourceEnum.SpendingAccounts, OCResourceEnum.ApprovalRules, OCResourceEnum.UserGroupAssignments, OCResourceEnum.SpendingAccountAssignments, OCResourceEnum.AddressAssignments, OCResourceEnum.CostCenterAssignments, OCResourceEnum.CreditCardAssignments, OCResourceEnum.SpendingAccountAssignments],
    },
    {
        name: OCResourceEnum.Users,
        modelName: "User",
        sdkObject: ordercloudJavascriptSdk.Users,
        createPriority: 4,
        parentRefField: "BuyerID",
        path: "/buyers/{buyerID}/users",
        isChild: true,
    },
    {
        name: OCResourceEnum.UserGroups,
        modelName: "UserGroup",
        sdkObject: ordercloudJavascriptSdk.UserGroups,
        createPriority: 4,
        parentRefField: "BuyerID",
        path: "/buyers/{buyerID}/usergroups",
        isChild: true,
    },
    {
        name: OCResourceEnum.Addresses,
        modelName: "Address",
        sdkObject: ordercloudJavascriptSdk.Addresses,
        createPriority: 4,
        parentRefField: "BuyerID",
        path: "/buyers/{buyerID}/addresses",
        isChild: true,
    },
    {
        name: OCResourceEnum.CostCenters,
        modelName: "CostCenter",
        sdkObject: ordercloudJavascriptSdk.CostCenters,
        createPriority: 4,
        parentRefField: "BuyerID",
        path: "/buyers/{buyerID}/costcenters",
        isChild: true,
    },
    {
        name: OCResourceEnum.CreditCards,
        modelName: "CreditCard",
        sdkObject: ordercloudJavascriptSdk.CreditCards,
        createPriority: 4,
        parentRefField: "BuyerID",
        path: "/buyers/{buyerID}/creditcards",
        isChild: true,
    },
    {
        name: OCResourceEnum.SpendingAccounts,
        modelName: "SpendingAccount",
        sdkObject: ordercloudJavascriptSdk.SpendingAccounts,
        createPriority: 4,
        parentRefField: "BuyerID",
        path: "/buyers/{buyerID}/spendingaccounts",
        isChild: true,
    },
    {
        name: OCResourceEnum.ApprovalRules,
        modelName: "ApprovalRule",
        sdkObject: ordercloudJavascriptSdk.ApprovalRules,
        createPriority: 5,
        parentRefField: "BuyerID",
        isChild: true,
        path: "/buyers/{buyerID}/approvalrules",
        foreignKeys: {
            ApprovingGroupID: {
                foreignParentRefField: "BuyerID",
                foreignResource: OCResourceEnum.UserGroups
            }
        }
    },
    {
        name: OCResourceEnum.Catalogs,
        modelName: "Catalog",
        sdkObject: ordercloudJavascriptSdk.Catalogs,
        createPriority: 2,
        path: "/catalogs",
        children: [OCResourceEnum.Categories, OCResourceEnum.CategoryAssignments, OCResourceEnum.CategoryProductAssignments]
    },
    {
        name: OCResourceEnum.Categories,
        modelName: "Category",
        sdkObject: ordercloudJavascriptSdk.Categories,
        createPriority: 3,
        parentRefField: "CatalogID",
        isChild: true,
        path: "/catalogs/{catalogID}/categories",
        foreignKeys: {
            ParentID: {
                foreignParentRefField: "CatalogID",
                foreignResource: OCResourceEnum.Categories
            }
        }
    },
    {
        name: OCResourceEnum.Suppliers,
        modelName: "Supplier",
        sdkObject: ordercloudJavascriptSdk.Suppliers,
        createPriority: 2,
        path: "/suppliers",
        children: [OCResourceEnum.SupplierUsers, OCResourceEnum.SupplierUserGroups, OCResourceEnum.SupplierAddresses, OCResourceEnum.SupplierUserGroupsAssignments]
    },
    {
        name: OCResourceEnum.SupplierUsers,
        modelName: "User",
        sdkObject: ordercloudJavascriptSdk.SupplierUsers,
        createPriority: 3,
        parentRefField: "SupplierID",
        path: "/suppliers/{supplierID}/users",
        isChild: true,
    },
    {
        name: OCResourceEnum.SupplierUserGroups,
        modelName: "UserGroup",
        sdkObject: ordercloudJavascriptSdk.SupplierUserGroups,
        createPriority: 3,
        parentRefField: "SupplierID",
        path: "/suppliers/{supplierID}/usergroups",
        isChild: true,
    },
    {
        name: OCResourceEnum.SupplierAddresses,
        modelName: "Address",
        sdkObject: ordercloudJavascriptSdk.SupplierAddresses,
        createPriority: 3,
        parentRefField: "SupplierID",
        path: "/suppliers/{supplierID}/addresses",
        isChild: true,
    },
    {
        name: OCResourceEnum.Products,
        modelName: "Product",
        sdkObject: ordercloudJavascriptSdk.Products,
        createPriority: 4,
        path: "/products",
        foreignKeys: {
            DefaultPriceScheduleID: { foreignResource: OCResourceEnum.PriceSchedules },
            ShipFromAddressID: { foreignResource: OCResourceEnum.AdminAddresses },
            DefaultSupplierID: { foreignResource: OCResourceEnum.Suppliers }
        }
    },
    {
        name: OCResourceEnum.PriceSchedules,
        modelName: "PriceSchedule",
        sdkObject: ordercloudJavascriptSdk.PriceSchedules,
        path: "/priceschedules",
        createPriority: 2
    },
    {
        name: OCResourceEnum.Specs,
        modelName: "Spec",
        sdkObject: ordercloudJavascriptSdk.Specs,
        createPriority: 2,
        path: "/specs",
        foreignKeys: {
            DefaultOptionID: { foreignResource: OCResourceEnum.SpecOptions },
        },
        children: [OCResourceEnum.SpecOptions]
    },
    {
        name: OCResourceEnum.SpecOptions,
        modelName: "SpecOption",
        sdkObject: ordercloudJavascriptSdk.Specs,
        createPriority: 3,
        path: "/specs/{specID}/options",
        parentRefField: "SpecID",
        listMethodName: "ListOptions",
        isChild: true
    },
    {
        name: OCResourceEnum.ProductFacets,
        modelName: "ProductFacet",
        sdkObject: ordercloudJavascriptSdk.ProductFacets,
        path: "/productfacets",
        createPriority: 2
    },
    {
        name: OCResourceEnum.Promotions,
        modelName: "Promotion",
        sdkObject: ordercloudJavascriptSdk.Promotions,
        path: "/promotions",
        createPriority: 2
    },
    {
        name: OCResourceEnum.SecurityProfileAssignments,
        modelName: "SecurityProfileAssignment",
        sdkObject: ordercloudJavascriptSdk.SecurityProfiles,
        path: "/securityprofiles/assignments",
        createPriority: 5,
        isAssignment: true,
        foreignKeys: {
            SecurityProfileID: { foreignResource: OCResourceEnum.SecurityProfiles },
            BuyerID: { foreignResource: OCResourceEnum.Buyers },
            SupplierID: { foreignResource: OCResourceEnum.Suppliers },
        },
        customValidationFunc: SecurityProfileAssignmentValidationFunc
    },
    {
        name: OCResourceEnum.AdminUserGroupAssignments,
        modelName: "UserGroupAssignment",
        sdkObject: ordercloudJavascriptSdk.AdminUserGroups,
        createPriority: 3,
        isAssignment: true,
        path: "/usergroups/assignments",
        listMethodName: 'ListUserAssignments',
        foreignKeys: {
            UserID: { foreignResource: OCResourceEnum.AdminUsers },
            UserGroupID: { foreignResource: OCResourceEnum.AdminUserGroups },
        },
    },
    {
        name: OCResourceEnum.ApiClientAssignments,
        modelName: "ApiClientAssignment",
        sdkObject: ordercloudJavascriptSdk.ApiClients,
        createPriority: 6,
        isAssignment: true,
        path: "/apiclients/assignments",
        foreignKeys: {
            ApiClientID: { foreignResource: OCResourceEnum.ApiClients },
            BuyerID: { foreignResource: OCResourceEnum.Buyers },
            SupplierID: { foreignResource: OCResourceEnum.Suppliers },
        },
    },
    {
        name: OCResourceEnum.UserGroupAssignments,
        modelName: "UserGroupAssignment",
        sdkObject: ordercloudJavascriptSdk.UserGroups,
        createPriority: 5,
        isAssignment: true,
        path: "/buyers/{buyerID}/usergroups/assignments",
        parentRefField: "BuyerID",
        isChild: true,
        listMethodName: 'ListUserAssignments',
        foreignKeys: {
            UserID: {
                foreignParentRefField: "BuyerID",
                foreignResource: OCResourceEnum.Users
            },
            UserGroupID: {
                foreignParentRefField: "BuyerID",
                foreignResource: OCResourceEnum.UserGroups
            },
        },
    },
    {
        name: OCResourceEnum.AddressAssignments,
        modelName: "AddressAssignment",
        sdkObject: ordercloudJavascriptSdk.Addresses,
        createPriority: 5,
        path: "/buyers/{buyerID}/addresses/assignments",
        isAssignment: true,
        parentRefField: "BuyerID",
        isChild: true,
        foreignKeys: {
            AddressID: {
                foreignParentRefField: "BuyerID",
                foreignResource: OCResourceEnum.Addresses
            },
            UserID: {
                foreignParentRefField: "BuyerID",
                foreignResource: OCResourceEnum.Users
            },
            UserGroupID: {
                foreignParentRefField: "BuyerID",
                foreignResource: OCResourceEnum.UserGroups
            },
        },
    },
    {
        name: OCResourceEnum.CostCenterAssignments,
        modelName: "CostCenterAssignment",
        sdkObject: ordercloudJavascriptSdk.CostCenters,
        createPriority: 5,
        path: "/buyers/{buyerID}/costcenters",
        isAssignment: true,
        parentRefField: "BuyerID",
        isChild: true,
        foreignKeys: {
            CostCenterID: {
                foreignParentRefField: "BuyerID",
                foreignResource: OCResourceEnum.CostCenters
            },
            UserGroupID: {
                foreignParentRefField: "BuyerID",
                foreignResource: OCResourceEnum.UserGroups,
            },
        },
    },
    {
        name: OCResourceEnum.CreditCardAssignments,
        modelName: "CreditCardAssignment",
        sdkObject: ordercloudJavascriptSdk.CreditCards,
        createPriority: 5,
        path: "/buyers/{buyerID}/creditcards/assignments",
        isAssignment: true,
        parentRefField: "BuyerID",
        isChild: true,
        foreignKeys: {
            CreditCardID: {
                foreignParentRefField: "BuyerID",
                foreignResource: OCResourceEnum.Addresses
            },
            UserID: {
                foreignParentRefField: "BuyerID",
                foreignResource: OCResourceEnum.Users
            },
            UserGroupID: {
                foreignParentRefField: "BuyerID",
                foreignResource: OCResourceEnum.UserGroups
            },
        },
    },
    {
        name: OCResourceEnum.SpendingAccountAssignments,
        modelName: "SpendingAccountAssignment",
        sdkObject: ordercloudJavascriptSdk.SpendingAccounts,
        createPriority: 5,
        path: "/buyers/{buyerID}/spendingaccounts/assignments",
        isAssignment: true,
        parentRefField: "BuyerID",
        isChild: true,
        foreignKeys: {
            SpendingAccountID: {
                foreignParentRefField: "BuyerID",
                foreignResource: OCResourceEnum.SpendingAccounts
            },
            UserID: {
                foreignParentRefField: "BuyerID",
                foreignResource: OCResourceEnum.Users
            },
            UserGroupID: {
                foreignParentRefField: "BuyerID",
                foreignResource: OCResourceEnum.UserGroups
            },
        },
    },
    {
        name: OCResourceEnum.SupplierUserGroupsAssignments,
        modelName: "UserGroupAssignment",
        sdkObject: ordercloudJavascriptSdk.SupplierUserGroups,
        createPriority: 4,
        path: "/suppliers/{supplierID}/usergroups/assignments",
        isAssignment: true,
        parentRefField: "SupplierID",
        isChild: true,
        listMethodName: 'ListUserAssignments',
        foreignKeys: {
            UserID: {
                foreignParentRefField: "SupplierID",
                foreignResource: OCResourceEnum.SupplierUsers
            },
            UserGroupID: {
                foreignParentRefField: "SupplierID",
                foreignResource: OCResourceEnum.SupplierUserGroups
            },
        },
    },
    {
        name: OCResourceEnum.ProductAssignments,
        modelName: "ProductAssignment",
        sdkObject: ordercloudJavascriptSdk.Products,
        createPriority: 5,
        path: "/products/assignments",
        isAssignment: true,
        foreignKeys: {
            ProductID: { foreignResource: OCResourceEnum.Products },
            BuyerID: { foreignResource: OCResourceEnum.Buyers },
            UserGroupID: {
                foreignParentRefField: "BuyerID",
                foreignResource: OCResourceEnum.UserGroups
            },
            PriceScheduleID: { foreignResource: OCResourceEnum.PriceSchedules }
        },
    },
    {
        name: OCResourceEnum.CatalogAssignments,
        modelName: "CatalogAssignment",
        sdkObject: ordercloudJavascriptSdk.Catalogs,
        createPriority: 4,
        path: "/catalogs/assignments",
        isAssignment: true,
        foreignKeys: {
            CatalogID: { foreignResource: OCResourceEnum.Catalogs },
            BuyerID: { foreignResource: OCResourceEnum.Buyers }
        },
    },
    {
        name: OCResourceEnum.ProductCatalogAssignment,
        modelName: "ProductCatalogAssignment",
        sdkObject: ordercloudJavascriptSdk.Catalogs,
        createPriority: 5,
        path: "/catalogs/productassignments",
        isAssignment: true,
        listMethodName: 'ListProductAssignments',
        foreignKeys: {
            CatalogID: { foreignResource: OCResourceEnum.Catalogs },
            ProductID: { foreignResource: OCResourceEnum.Products }
        },
    },
    {
        name: OCResourceEnum.CategoryAssignments,
        modelName: "CategoryAssignment",
        sdkObject: ordercloudJavascriptSdk.Categories,
        createPriority: 5,
        path: "/catalogs/{catalogID}/categories/assignments",
        isAssignment: true,
        parentRefField: "CatalogID",
        isChild: true,
        foreignKeys: {
            CategoryID: {
                foreignParentRefField: "CatalogID",
                foreignResource: OCResourceEnum.Categories
            },
            BuyerID: { foreignResource: OCResourceEnum.Buyers },
            UserGroupID: {
                foreignParentRefField: "BuyerID",
                foreignResource: OCResourceEnum.UserGroups
            },
        },
    },
    {
        name: OCResourceEnum.CategoryProductAssignments,
        modelName: "CategoryProductAssignment",
        sdkObject: ordercloudJavascriptSdk.Categories,
        createPriority: 5,
        path: "/catalogs/{catalogID}/categories/productassignments",
        isAssignment: true,
        parentRefField: "CatalogID",
        isChild: true,
        listMethodName: 'ListProductAssignments',
        foreignKeys: {
            CategoryID: {
                foreignParentRefField: "CatalogID",
                foreignResource: OCResourceEnum.Categories
            },
            ProductID: { foreignResource: OCResourceEnum.Products },
        },
    },
    {
        name: OCResourceEnum.SpecProductAssignments,
        modelName: "SpecProductAssignment",
        sdkObject: ordercloudJavascriptSdk.Specs,
        createPriority: 5,
        path: "/specs/productassignments",
        isAssignment: true,
        listMethodName: 'ListProductAssignments',
        foreignKeys: {
            SpecID: { foreignResource: OCResourceEnum.Specs },
            ProductID: { foreignResource: OCResourceEnum.Products },
            DefaultOptionID: {
                foreignParentRefField: "SpecID",
                foreignResource: OCResourceEnum.SpecOptions
            },
        },
    },
    {
        name: OCResourceEnum.PromotionAssignment,
        modelName: "PromotionAssignment",
        sdkObject: ordercloudJavascriptSdk.Promotions,
        createPriority: 5,
        path: "/promotions/assignments",
        isAssignment: true,
        foreignKeys: {
            PromotionID: { foreignResource: OCResourceEnum.Promotions },
            BuyerID: { foreignResource: OCResourceEnum.Buyers },
            UserGroupID: {
                foreignParentRefField: "BuyerID",
                foreignResource: OCResourceEnum.UserGroups
            },
        },
    },
];
function ApplyDefaults(resource) {
    var _a, _b;
    resource.isAssignment = resource.isAssignment || false;
    resource.listMethodName = resource.listMethodName || (resource.isAssignment ? "ListAssignments" : "List");
    resource.createMethodName = resource.createMethodName || (resource.isAssignment ? "CreateAssignment" : "Create");
    resource.foreignKeys = resource.foreignKeys || {};
    resource.children = resource.children || [];
    resource.isChild = resource.isChild || false;
    resource.requiredCreateFields = (_a = resource.requiredCreateFields) !== null && _a !== void 0 ? _a : [];
    resource.redactFields = (_b = resource.redactFields) !== null && _b !== void 0 ? _b : [];
    return resource;
}
async function BuildResourceDirectory(includeOpenAPI = false) {
    var openAPISpec;
    if (includeOpenAPI) {
        openAPISpec = await axios__default['default'].get(`https://api.ordercloud.io/v1/openapi/v3`);
    }
    return Directory.map(resource => {
        var _a, _b, _c, _d, _e;
        var modified = ApplyDefaults(resource);
        if (includeOpenAPI) {
            var path = openAPISpec.data.paths[resource.path];
            var operation = (_a = path.post) !== null && _a !== void 0 ? _a : path.put;
            modified.requiredCreateFields = (_e = (_d = (_c = (_b = operation.requestBody.content) === null || _b === void 0 ? void 0 : _b["application/json"]) === null || _c === void 0 ? void 0 : _c.schema) === null || _d === void 0 ? void 0 : _d.required) !== null && _e !== void 0 ? _e : [];
            modified.openAPIProperties = openAPISpec.data.components.schemas[resource.modelName].properties;
            if (modified.isChild) {
                modified.parentResource = Directory.find(x => x.children.includes(modified.name));
            }
        }
        return modified;
    }).reduce((acc, resource) => {
        acc[resource.name] = resource;
        return acc;
    }, {});
}

async function download(username, password, environment, orgID, path) {
    var missingInputs = [];
    var validEnvironments = ['staging', 'sandbox', 'prod'];
    var urls = {
        staging: "https://stagingapi.ordercloud.io",
        sandbox: "https://sandboxapi.ordercloud.io",
        prod: "https://api.ordercloud.io",
    };
    if (!environment)
        missingInputs.push("environment");
    if (!orgID)
        missingInputs.push("orgID");
    if (!username)
        missingInputs.push("username");
    if (!password)
        missingInputs.push("password");
    if (missingInputs.length > 0) {
        return log(`Missing required arguments: ${missingInputs.join(", ")}`, MessageType.Error);
    }
    if (!validEnvironments.includes(environment)) {
        return log(`environment must be one of ${validEnvironments.join(", ")}`, MessageType.Error);
    }
    var url = urls[environment];
    // Set up configuration
    ordercloudJavascriptSdk.Configuration.Set({ baseApiUrl: url });
    // Authenticate
    var portal_token;
    var org_token;
    try {
        portal_token = await Portal.login(username, password);
    }
    catch (_a) {
        return log(`Username \"${username}\" and Password \"${password}\" were not valid`, MessageType.Error);
    }
    try {
        org_token = await Portal.getOrganizationToken(orgID, portal_token);
    }
    catch (_b) {
        return log(`Organization with ID \"${orgID}\" not found`, MessageType.Error);
    }
    var decoded = jwt_decode__default['default'](org_token);
    if (decoded.aud !== url) {
        return log(`Organization \"${orgID}\" found, but is not in specified environment \"${environment}\"`, MessageType.Error);
    }
    ordercloudJavascriptSdk.Tokens.SetAccessToken(org_token);
    log("Found your organization. Beginning download.", MessageType.Success);
    // Pull Data from Ordercloud
    var file = new SeedFile();
    var directory = await BuildResourceDirectory(false);
    for (let key in directory) {
        var resource = directory[key];
        if (resource.isChild) {
            continue; // resource will be handled as part of its parent
        }
        var records = await OrderCloudBulk.ListAll(resource);
        RedactSensitiveFields(resource, records);
        if (resource.downloadTransformFunc !== undefined) {
            records = records.map(resource.downloadTransformFunc);
        }
        file.AddRecords(resource, records);
        for (let childResourceName of resource.children) {
            let childResource = directory[childResourceName];
            for (let parentRecord of records) {
                var childRecords = await OrderCloudBulk.ListAll(childResource, parentRecord.ID); // assume ID exists. Which is does for all parent types.
                for (let childRecord of childRecords) {
                    childRecord[childResource.parentRefField] = parentRecord.ID;
                }
                if (childResource.downloadTransformFunc !== undefined) {
                    childRecords = childRecords.map(resource.downloadTransformFunc);
                }
                file.AddRecords(childResource, childRecords);
            }
            log("Finished " + childRecords.length + " " + childResourceName);
        }
        log("Finished " + records.length + " " + resource.name);
    }
    // Write to file
    file.WriteToYaml(path);
    log(`Done! Wrote to file \"${path}\"`, MessageType.Success);
    function RedactSensitiveFields(resource, records) {
        if (resource.redactFields.length === 0)
            return;
        for (var record of records) {
            for (var field of resource.redactFields) {
                if (!___default['default'].isNil(record[field])) {
                    record[field] = "<Redacted for Security>";
                }
            }
        }
    }
}
//dotenv.config({ path: '.env' });
//download(process.env.PORTAL_USERNAME, process.env.PORTAL_PASSWORD, process.env.OC_ENV, process.env.ORG_ID, 'ordercloud-seed.yml');

class IDCache {
    constructor() {
        this.idSets = {};
    }
    add(resourceType, key) {
        var set = this.idSets[resourceType];
        if (set === undefined) {
            set = this.idSets[resourceType] = new Set();
        }
        set.add(key);
    }
    has(resourceType, key) {
        var _a, _b;
        return (_b = (_a = this.idSets[resourceType]) === null || _a === void 0 ? void 0 : _a.has(key)) !== null && _b !== void 0 ? _b : false;
    }
}

async function validate(filePath) {
    var file = new SeedFile();
    var validator = new Validator();
    // validates file is found and is valid yaml
    var success = file.ReadFromYaml(filePath, validator.errors);
    if (!success) {
        for (const error of validator.errors) {
            log(error, MessageType.Error);
        }
        return validator.errors;
    }
    var directory = await BuildResourceDirectory(true);
    // validate duplicate IDs 
    for (let resourceEnum in directory) {
        validator.currentResource = directory[resourceEnum];
        var hasUsername = "Username" in validator.currentResource.openAPIProperties;
        var hasID = hasIDProperty(validator.currentResource);
        if (hasID || hasUsername) {
            for (let record of file.GetRecords(validator.currentResource)) {
                validator.currentRecord = record;
                // this step builds validator.idCache, which will be needed for forign key validation later.             
                if (hasID)
                    validator.validateDuplicateIDs();
                if (hasUsername)
                    validator.validateDuplicateUsernames();
            }
        }
    }
    // now that idSets are built, another loop for the rest of validation
    for (let resourceEnum in directory) {
        validator.currentResource = directory[resourceEnum];
        for (let record of file.GetRecords(validator.currentResource)) {
            validator.currentRecord = record;
            for (const [propName, spec] of Object.entries(validator.currentResource.openAPIProperties)) {
                validator.currentPropertyName = propName;
                if (spec.readOnly) {
                    continue;
                }
                let value = record[propName];
                let foreignKey = validator.currentResource.foreignKeys[propName];
                if (___default['default'].isNil(value)) {
                    validator.validateIsRequired(propName);
                }
                else {
                    var typeMatches = validator.validateFieldTypeMatches(record[propName], spec);
                    if (typeMatches && !___default['default'].isNil(foreignKey)) {
                        validator.validateForeignKeyExists(foreignKey);
                    }
                }
            }
            if (validator.currentResource.isChild) {
                validator.currentPropertyName = validator.currentResource.parentRefField;
                validator.validateParentRef(validator.currentResource.parentResource.name);
            }
            if (validator.currentResource.customValidationFunc !== undefined) {
                validator.currentResource.customValidationFunc(record, validator);
            }
        }
    }
    for (const error of validator.errors) {
        log(error, MessageType.Error);
    }
    if (validator.errors.length === 0) {
        log("Ready for upload!", MessageType.Success);
    }
    return validator.errors;
}
function hasIDProperty(resource) {
    return 'ID' in resource.openAPIProperties || resource.name === OCResourceEnum.ApiClients;
}
function getType(value) {
    if (___default['default'].isArray(value))
        return 'array';
    if (___default['default'].isPlainObject(value))
        return 'object';
    if (___default['default'].isString(value))
        return 'string';
    if (___default['default'].isBoolean(value))
        return 'boolean';
    if (___default['default'].isInteger(value))
        return 'integer';
    return 'number';
}
class Validator {
    constructor() {
        this.errors = [];
        this.idCache = new IDCache();
        this.usernameCache = new Set();
    }
    addError(message) {
        this.errors.push(message);
    }
    validateIsRequired(fieldName) {
        if (this.currentResource.requiredCreateFields.includes(fieldName)) {
            this.addError(`Required field ${this.currentResource.name}.${fieldName}: cannot have value ${this.currentRecord[fieldName]}.`);
            return false;
        }
        return true;
    }
    validateParentRef(parentType) {
        var value = this.currentRecord[this.currentResource.parentRefField];
        if (___default['default'].isNil(value)) {
            this.addError(`Required field ${this.currentResource.name}.${this.currentResource.parentRefField}: cannot have value ${value}.`);
            return false;
        }
        if (!this.validateFieldTypeMatches(value, { type: "string", readOnly: false })) {
            return false;
        }
        if (!this.idCache.has(parentType, value)) {
            this.addError(`Invalid reference ${this.currentResource.name}.${this.currentResource.parentRefField}: no ${parentType} found with ID \"${value}\".`);
            return false;
        }
        return true;
    }
    validateForeignKeyExists(foreignKey) {
        var field = this.currentPropertyName;
        var value = this.currentRecord[field];
        var setEntry = foreignKey.foreignParentRefField === undefined ? value : `${this.currentRecord[foreignKey.foreignParentRefField]}/${value}`;
        // find an ID of a particular resource
        var keyExists = this.idCache.has(foreignKey.foreignResource, setEntry);
        if (!keyExists) {
            var message = `Invalid reference ${this.currentResource.name}.${field}: no ${foreignKey.foreignResource} found with ID \"${value}\".`;
            if (setEntry.includes('/')) {
                message = message.concat(` within the ${foreignKey.foreignParentRefField} \"${this.currentRecord[foreignKey.foreignParentRefField]}\"`);
            }
            this.addError(message);
            return false;
        }
        return true;
    }
    // TODO - validate things inside objects or arrays
    validateFieldTypeMatches(value, spec) {
        // todo - need to do this differently. Get a swagger parser library
        if (spec.allOf) {
            spec.type = "object";
        }
        var error = null;
        var typeError = `Incorrect type ${this.currentResource.name}.${this.currentPropertyName}: ${value} is ${getType(value)}. Should be ${spec.type}.`;
        switch (spec.type) {
            case 'object':
                if (!___default['default'].isPlainObject(value))
                    error = typeError;
                break;
            case 'array':
                if (!___default['default'].isArray(value))
                    error = typeError;
                break;
            case 'integer':
                if (!___default['default'].isInteger(value)) {
                    error = typeError;
                }
                else {
                    if ((spec.maximum || Infinity) < value) {
                        error = `Maximum for ${this.currentResource.name}.${this.currentPropertyName} is ${spec.maximum}. Found ${value}.`;
                    }
                    if ((spec.minimum || -Infinity) > value) {
                        error = `Minimum for ${this.currentResource.name}.${this.currentPropertyName} is ${spec.minimum}. Found ${value}.`;
                    }
                }
                break;
            case 'number':
                if (!___default['default'].isNumber(value))
                    error = typeError;
                break;
            case 'boolean':
                if (!___default['default'].isBoolean(value))
                    error = typeError;
                break;
            case 'string':
                if (!___default['default'].isString(value)) {
                    error = typeError;
                }
                else {
                    if ((spec.maxLength || Infinity) < value.length) {
                        error = `Max string length for ${this.currentResource.name}.${this.currentPropertyName} is ${spec.maxLength}. Found \"${value}\".`;
                    }
                    if (spec.format === 'date-time' && !Date.parse(value)) {
                        error = `${this.currentResource.name}.${this.currentPropertyName} should be a date format. Found \"${value}\".`;
                    }
                }
                break;
        }
        if (error !== null) {
            this.addError(error);
            return false;
        }
        return true;
    }
    // todo - need to validate duplicates that involve more fields that simply ID. e.g. xpindex 
    validateDuplicateIDs() {
        if (___default['default'].isNil(this.currentRecord.ID) || !hasIDProperty(this.currentResource)) {
            return true;
        }
        var setEntry = this.currentResource.isChild ? `${this.currentRecord[this.currentResource.parentRefField]}/${this.currentRecord.ID}` : this.currentRecord.ID;
        if (this.idCache.has(this.currentResource.name, setEntry)) {
            var message = `Duplicate ID: multiple ${this.currentResource.name} with ID \"${this.currentRecord.ID}\"`;
            if (setEntry.includes('/')) {
                message = message.concat(` within the ${this.currentResource.parentRefField} \"${this.currentRecord[this.currentResource.parentRefField]}\"`);
            }
            this.addError(message);
            return false;
        }
        else {
            this.idCache.add(this.currentResource.name, setEntry);
        }
        return true;
    }
    // username needs to be unique within a marketplace
    validateDuplicateUsernames() {
        var username = this.currentRecord.Username;
        if (___default['default'].isNil(username) || !('Username' in this.currentResource.openAPIProperties)) {
            return true;
        }
        if (this.usernameCache.has(username)) {
            var message = `Duplicate Username: multiple users with username \"${username}\"`;
            this.addError(message);
            return false;
        }
        else {
            this.usernameCache.add(username);
        }
        return true;
    }
}

yargs__default['default'].scriptName("@ordercloud/seeding")
    .usage('$0 <cmd> [args] -')
    .command('download', 'Download all org data into a file', (yargs) => {
    yargs.option('environment', {
        type: 'string',
        alias: 'e',
        describe: 'Environment'
    });
    yargs.option('orgID', {
        type: 'string',
        alias: 'o',
        describe: 'Organization ID'
    });
    yargs.option('username', {
        type: 'string',
        alias: 'u',
        describe: 'Portal username'
    });
    yargs.option('password', {
        type: 'string',
        alias: 'p',
        describe: 'Portal password'
    });
    yargs.option('file', {
        type: 'string',
        alias: 'f',
        default: 'ordercloud-seed.yml',
        describe: 'File'
    });
}, function (argv) {
    download(argv.u, argv.p, argv.e, argv.o, argv.f);
})
    .command('validate', 'Validate a potential file for upload', (yargs) => {
    yargs.option('file', {
        type: 'string',
        alias: 'f',
        default: 'ordercloud-seed.yml',
        describe: 'File'
    });
}, function (argv) {
    validate(argv.f);
})
    .help()
    .argv;
