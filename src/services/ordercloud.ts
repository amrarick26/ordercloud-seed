import { Auth, AccessToken, Configuration, ApiRole } from 'ordercloud-javascript-sdk';

export default class OrderCloudAPI {
    constructor(environment: string) {
        var baseApiUrl: string;
        switch(environment.toLocaleLowerCase()) {
          case "sandbox":
            baseApiUrl = "https://sandboxapi.ordercloud.io";
            break;
          case "production":
            baseApiUrl =  "https://api.ordercloud.io";
            break;
          case "staging":
            baseApiUrl =  "https://stagingapi.ordercloud.io";
            break;
          default:
            baseApiUrl =  "https://sandboxapi.ordercloud.io";
            break;
        }
        Configuration.Set({
          baseApiUrl
        })
      }
    
    async clientCredentials(clientSecret: string, clientID: string, scope: ApiRole[]): Promise<AccessToken> {
      return await Auth.ClientCredentials(clientSecret, clientID, scope);
    }

    async login(username: string, password: string, clientID: string, scope: ApiRole[]): Promise<AccessToken> {
        return await Auth.Login(username, password, clientID, scope)
    }

    async refreshToken(refreshToken: string, clientID: string): Promise<AccessToken> {
        return await Auth.RefreshToken(refreshToken, clientID);
    }
}