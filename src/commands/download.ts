import Bottleneck from 'bottleneck';
import _ from 'lodash';
import { AccessToken, ApiRole, Tokens } from 'ordercloud-javascript-sdk';
import { REDACTED_MESSAGE, TEN_MINUTES } from '../constants';
import { BuildResourceDirectory } from '../models/oc-resource-directory';
import { OCResourceEnum } from '../models/oc-resource-enum';
import { OCResource } from '../models/oc-resources';
import { SerializedMarketplace } from '../models/serialized-marketplace';
import { LogCallBackFunc, MessageType, defaultLogger } from '../services/logger';
import OrderCloudAPI from '../services/ordercloud';
import OrderCloudBulk from '../services/ordercloud-bulk';
import { RefreshTimer } from '../services/refresh-timer';

export interface DownloadArgs {
    grantType?: string;
    clientID?: string; 
    username?: string; 
    password?: string; 
    clientSecret?: string;
    token?: string;
    scope?: string
    logger?: LogCallBackFunc
}

export async function download(args: DownloadArgs): Promise<SerializedMarketplace | void> {
    var { 
        grantType,
        clientID, 
        username, 
        password, 
        clientSecret,
        scope,
        token,
        logger = defaultLogger
    } = args;
    // Authenticate
    var oc = new OrderCloudAPI();
    var tokenResponse: AccessToken;
    var ocToken: string;
    var ocRefreshToken: string;
    var userLoginAuthUsed = _.isNil(token);
    if (userLoginAuthUsed) {
        if (!clientID) {
            return logger(`Missing required argument: clientID`, MessageType.Error);
        }
        var ocRoles: ApiRole[] = scope.split(',') as ApiRole[];

        if (grantType == "password" && (_.isNil(username) || _.isNil(password))) 
            return logger(`Missing required arguments: username and password`, MessageType.Error)
        
        if (grantType == "client_credentials" && _.isNil(clientSecret))
            return logger(`Missing required arguments: clientSecret`, MessageType.Error)

        try {
            tokenResponse = grantType == "password" ? await oc.login(username, password, clientID, ocRoles) : await oc.clientCredentials(clientSecret, clientID, ocRoles);
        } catch (ex) {
            return logger(`There was an error authenticating with the given credentials`, MessageType.Error);
        }
    
        ocToken = tokenResponse?.access_token;
        ocRefreshToken = tokenResponse?.refresh_token;
        RefreshTimer.set(refreshTokenFunc, TEN_MINUTES)

    } else {
        ocToken = token;
    }
    Tokens.SetAccessToken(ocToken);

    logger(`Successfully authenticated. Beginning download.`, MessageType.Success);

    // Pull Data from Ordercloud
    var ordercloudBulk = new OrderCloudBulk(new Bottleneck({
        minTime: 100,
        maxConcurrent: 8
    }), logger);
    var marketplace = new SerializedMarketplace();
    var directory = await BuildResourceDirectory();
    var childResourceRecordCounts = {}; 
    for (let resource of directory) {
        if (resource.isChild) {
            continue; // resource will be handled as part of its parent
        }
        var records = await ordercloudBulk.ListAll(resource);
        RedactSensitiveFields(resource, records);
        //PlaceHoldMarketplaceID(resource, records);
        if (resource.downloadTransformFunc !== undefined) {
            records = records.map(resource.downloadTransformFunc)
        }
        logger(`Found ${records?.length || 0} ${resource.name}`);
        marketplace.AddRecords(resource, records);
        for (let childResourceName of resource.children)
        {
            let childResource = directory.find(x => x.name === childResourceName);
            childResourceRecordCounts[childResourceName] = 0;
            childResourceRecordCounts[OCResourceEnum.VariantInventoryRecords] = 0;
            for (let parentRecord of records) {
                if (childResource.shouldAttemptListFunc(parentRecord)) {
                    var childRecords = await ordercloudBulk.ListAll(childResource, parentRecord.ID); // assume ID exists. Which is does for all parent types.
                    childResourceRecordCounts[childResourceName] += childRecords.length;
                    //PlaceHoldMarketplaceID(childResource, childRecords);
                    if (childResource.downloadTransformFunc !== undefined) {
                        childRecords = childRecords.map(childResource.downloadTransformFunc)
                    }
                    for (let childRecord of childRecords) {
                        childRecord[childResource.parentRefField] = parentRecord.ID;
                    }
                    marketplace.AddRecords(childResource, childRecords);
                    if (childResource.name === OCResourceEnum.Variants) {
                        var grandChildResource = directory.find(x => x.name === OCResourceEnum.VariantInventoryRecords);
                        for (var variant of childRecords) {
                            var variantInventoryRecords = await ordercloudBulk.ListAll(grandChildResource, parentRecord.ID, variant.ID);
                            childResourceRecordCounts[OCResourceEnum.VariantInventoryRecords] += variantInventoryRecords.length;
                            //PlaceHoldMarketplaceID(grandChildResource, variantInventoryRecords);
                            for (let grandChildRecord of variantInventoryRecords) {
                                grandChildRecord["ProductID"] = parentRecord.ID;
                                grandChildRecord["VariantID"] = variant.ID;
                            }
                            marketplace.AddRecords(grandChildResource, variantInventoryRecords);
                        }                      
                    }   
                }
            } 
            logger(`Found ${childResourceRecordCounts[childResourceName]} ${childResourceName}`);
            if (childResource.name === OCResourceEnum.Variants) {
                logger(`Found ${childResourceRecordCounts[OCResourceEnum.VariantInventoryRecords]} ${OCResourceEnum.VariantInventoryRecords}`);
            }
        }
    }
    // Write to file
    //logger(`Done downloading data from org \"${marketplaceID}\".`, MessageType.Success);
    return marketplace;

    function RedactSensitiveFields(resource: OCResource, records: any[]): void {
        if (resource.redactFields.length === 0) return;

        for (var record of records) {
            for (var field of resource.redactFields) {
                if (!_.isNil(record[field])) {
                    record[field] = REDACTED_MESSAGE;
                }
            }
        }
    }

    // why are we doing this?
    // function PlaceHoldMarketplaceID(resource: OCResource, records: any[]): void {
    //     if (resource.hasOwnerIDField) {
    //         for (var record of records) {  
    //             // when Sandbox and Staging were created, marketplace IDs were appended with env to keep them unique
    //             var mktplID = marketplaceID.replace(/_Sandbox$/, "").replace(/_Staging$/, "");
    //             if (record[resource.hasOwnerIDField] === mktplID) {
    //                 record[resource.hasOwnerIDField] = MARKETPLACE_ID_PLACEHOLDER;
    //             }
    //         }
    //     }
    // }

    async function refreshTokenFunc() {
        logger(`Refreshing the access token for. This should happen every 10 mins.`, MessageType.Warn)
  
        const ocTokenData = await oc.refreshToken(ocRefreshToken, clientID);
        ocToken = ocTokenData.access_token;
        ocRefreshToken = ocTokenData.refresh_token;
        Tokens.SetAccessToken(ocToken);
    }
} 