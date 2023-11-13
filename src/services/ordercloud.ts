import { Auth, AccessToken, Configuration, ApiRole } from 'ordercloud-javascript-sdk';

export default class OrderCloudAPI {
    constructor() {
        Configuration.Set({ // TODO: need to make this dynamic
          baseApiUrl: "https://sandboxapi.ordercloud.io"
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