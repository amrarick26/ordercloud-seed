import * as SeedingTemplates from '../../seeds/meta.json';
import { AccessToken, ApiRole, Configuration, Product, Products, Specs, Tokens, Variant } from 'ordercloud-javascript-sdk';
import OrderCloudBulk from '../services/ordercloud-bulk';
import _ from 'lodash';
import { defaultLogger, getElapsedTime, LogCallBackFunc, MessageType } from '../services/logger';
import { validate } from './validate';
import { BuildResourceDirectory } from '../models/oc-resource-directory';
import { OCResourceEnum } from '../models/oc-resource-enum';
import { OCResource } from '../models/oc-resources';
import Random from '../services/random';
import { REDACTED_MESSAGE,MARKETPLACE_ID, TEN_MINUTES } from '../constants';
import PortalAPI from '../services/portal';
import { SerializedMarketplace } from '../models/serialized-marketplace';
import { ApiClient } from '@ordercloud/portal-javascript-sdk';
import Bottleneck from 'bottleneck';
import { JobActionType, JobGroupMetaData, JobMetaData } from '../models/job-metadata';
import { RefreshTimer } from '../services/refresh-timer';
import OrderCloudAPI from '../services/ordercloud';

export interface SeedArgs {
    grantType?: string;
    clientID?: string; 
    username?: string; 
    password?: string; 
    clientSecret?: string;
    scope?: string
    token?: string;
    environment: string;
    dataUrl?: string;
    rawData?: SerializedMarketplace;
    logger?: LogCallBackFunc
}

export interface SeedResponse {
    accessToken: string;
    apiClients: ApiClient[];
}

export async function seed(args: SeedArgs): Promise<SeedResponse | void> {
    var { 
        grantType,
        clientID, 
        username, 
        password, 
        clientSecret,
        scope,
        token,
        environment,
        rawData,
        dataUrl,
        logger = defaultLogger
    } = args;
    var startTime = Date.now();

    // Check if the args contain an alias for a example seed template
    var template = SeedingTemplates.templates.find(x => x.name === dataUrl);
    if (!_.isNil(template)) {
        dataUrl = template.dataUrl;
    }
    
    // Run validation on the shape of the seed data
    var validateResponse = await validate({ rawData, dataUrl});
    if (validateResponse?.errors?.length !== 0) return;

    // Authenticate to OrderCloud
    if (!environment) 
        return logger('Missing required argument: environment. Possible values are Sandbox, Staging, or Production', MessageType.Error);
    var oc = new OrderCloudAPI(environment);
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
            return logger(`Missing required argument: clientSecret`, MessageType.Error)

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
    
    // Upload to Ordercloud
    var marketplaceData = new SerializedMarketplace(validateResponse.rawData);
    var ordercloudBulk = new OrderCloudBulk(new Bottleneck({
        minTime: 100,
        maxConcurrent: 8
    }), logger);
    var apiClientIDMap = {};
    var specDefaultOptionIDList = [];
    var webhookSecret = Random.generateWebhookSecret(); // use one webhook secret for all webhooks, integration events and message senders
    var directory = await BuildResourceDirectory();
    for (let resource of directory.sort((a, b) => a.createPriority - b.createPriority)) {
        var records = marketplaceData.GetRecords(resource);
        SetOwnerID(resource, records);
        if (resource.name === OCResourceEnum.ApiClients) {
            await UploadApiClients(resource);
        } else if (resource.name === OCResourceEnum.ImpersonationConfigs) {
            await UploadImpersonationConfigs(resource);
        } else if (resource.name === OCResourceEnum.Specs) {
            await UploadSpecs(resource);
        } else if (resource.name === OCResourceEnum.SpecOptions) {
            await UploadSpecOptions(resource);
        } else if (resource.name === OCResourceEnum.Webhooks) {
            await UploadWebhooks(resource);
        } else if (resource.name === OCResourceEnum.OpenIdConnects) {
            await UploadOpenIdConnects(resource);
        } else if (resource.name === OCResourceEnum.ApiClientAssignments) {
            await UploadApiClientAssignments(resource);
        } else if (resource.name === OCResourceEnum.MessageSenders) {
            await UploadMessageSenders(resource);
        } else if (resource.name === OCResourceEnum.IntegrationEvents) {
            await UploadIntegrationEvents(resource);
        } else if (resource.name === OCResourceEnum.Categories) {
            await UploadCategories(resource);
        } else if (resource.name === OCResourceEnum.Variants) {
            await GenerateAndPutVariants();
        } else {
            await ordercloudBulk.CreateAll(resource, records);
        }
        if (records.length != 0) {
            logger(`Created ${records.length} ${resource.name}.`, MessageType.Info);
        }   
    }

    
    var endTime = Date.now();
    logger(`Done! Total elapsed time: ${getElapsedTime(startTime, endTime)}`, MessageType.Done); 

    var apiClients = marketplaceData.Objects[OCResourceEnum.ApiClients]?.map(apiClient => {
        apiClient.ID = apiClientIDMap[apiClient.ID];
        return apiClient;
    }) || [];

    var results =  {
        accessToken: ocToken,
        apiClients
    }

    return results;

    function SetOwnerID(resource: OCResource, records: any[]) {
        if (resource.hasOwnerIDField) {
            for (var record of records) {
                if (record[resource.hasOwnerIDField] === MARKETPLACE_ID) {
                    record[resource.hasOwnerIDField] = "FIX ME - MARKETPLACEID";
                }
            }
        }
    }

    async function GenerateAndPutVariants() : Promise<void> {
        var products = marketplaceData.Objects[OCResourceEnum.Products] || [];
        var productsWithVariants = products.filter((p: Product) => p.VariantCount > 0);
        var meta: JobGroupMetaData = {
            resourceName: OCResourceEnum.Variants,
            actionType: JobActionType.CREATE,
        };
        ordercloudBulk.RunMany(meta, productsWithVariants, (p: Product) => Products.GenerateVariants(p.ID));
        var variants = marketplaceData.Objects[OCResourceEnum.Variants];
        await ordercloudBulk.RunMany(meta, variants, (v: any) => {
            var variantID = v.Specs.reduce((acc, spec) => `${acc}-${spec.OptionID}`, v.ProductID);
            return Products.SaveVariant(v.ProductID, variantID, v);
        });
        logger(`Generated variants for ${productsWithVariants.length} products.`, MessageType.Info);
    }

    // Need to remove and cache Spec.DefaultOptionID in order to PATCH it after the options are created.
    async function UploadSpecs(resource: OCResource): Promise<void> {
        records.forEach(r => {
            if (!_.isNil(r.DefaultOptionID)) { 
                specDefaultOptionIDList.push({ ID: r.ID, DefaultOptionID: r.DefaultOptionID}); // save for later step
                r.DefaultOptionID = null; // set null so create spec succeeds 
            }
        });
        await ordercloudBulk.CreateAll(resource, records);
    }

    // Patch Spec.DefaultOptionID after the options are created.
    async function UploadSpecOptions(resource: OCResource): Promise<void> {
        await ordercloudBulk.CreateAll(resource, records); 
        await ordercloudBulk.RunMany("SpecOption" as any, specDefaultOptionIDList, x => Specs.Patch(x.ID, { DefaultOptionID: x.DefaultOptionID }));
    }

    async function UploadApiClients(resource: OCResource): Promise<void> {
        records.forEach(r => {
            if (r.ClientSecret === REDACTED_MESSAGE) { 
                r.ClientSecret = Random.generateClientSecret();
            }
        });
        var results = await ordercloudBulk.CreateAll(resource, records);
        // Now that we have created the APIClients, we actually know what their IDs are.  
        for (var i = 0; i < records.length; i++) {
            apiClientIDMap[records[i].ID] = results[i].ID;
        }
    }

    async function UploadImpersonationConfigs(resource: OCResource): Promise<void> {
        records.forEach(r => r.ClientID = apiClientIDMap[r.ClientID]);
        await ordercloudBulk.CreateAll(resource, records);
    }

    async function UploadOpenIdConnects(resource: OCResource): Promise<void> {
        records.forEach(r => r.OrderCloudApiClientID = apiClientIDMap[r.OrderCloudApiClientID]);
        await ordercloudBulk.CreateAll(resource, records);
    }

    async function UploadCategories(resource: OCResource): Promise<void> {
        let depthCohort = records.filter(r => r.ParentID === null); // start with top-level
        while (depthCohort.length > 0) {
            // create in groups based on depth in the tree
            var results = await ordercloudBulk.CreateAll(resource, depthCohort);
            // get children of those just created
            depthCohort = records.filter(r => results.some(result => r.ParentID === result.ID));
        }
    }

    async function UploadMessageSenders(resource: OCResource): Promise<void> {
        records.forEach(r => {
            if (r.SharedKey === REDACTED_MESSAGE) {
                r.SharedKey = webhookSecret;
            }
        });
        await ordercloudBulk.CreateAll(resource, records);
    }

    async function UploadIntegrationEvents(resource: OCResource): Promise<void> {
        records.forEach(r => {
            if (r.HashKey === REDACTED_MESSAGE) {
                r.HashKey = webhookSecret;
            }
        });
        await ordercloudBulk.CreateAll(resource, records);
    }

    async function UploadWebhooks(resource: OCResource): Promise<void> {
        records.forEach(r => {
            r.ApiClientIDs = r.ApiClientIDs.map(id => apiClientIDMap[id])
            if (r.HashKey === REDACTED_MESSAGE) {
                r.HashKey = webhookSecret;
            }
        });
        await ordercloudBulk.CreateAll(resource, records);
    }

    async function UploadApiClientAssignments(resource: OCResource): Promise<void> {
        records.forEach(r => r.ApiClientID = apiClientIDMap[r.ApiClientID]);
        await ordercloudBulk.CreateAll(resource, records);
    }

    async function refreshTokenFunc() {
        logger(`Refreshing the access token for. This should happen every 10 mins.`, MessageType.Warn)
  
        const ocTokenData = await oc.refreshToken(ocRefreshToken, clientID);
        ocToken = ocTokenData.access_token;
        ocRefreshToken = ocTokenData.refresh_token;
        Tokens.SetAccessToken(ocToken);
    }
} 
