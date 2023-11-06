import { Auth, AccessToken, Configuration } from 'ordercloud-javascript-sdk';

export default class OrderCloudAPI {
    constructor() {
        Configuration.Set({ // TODO: need to make this dynamic
          baseApiUrl: "https://sandboxapi.ordercloud.io"
        })
      }
      
    async login(username, password, clientID, scope): Promise<AccessToken> {
        return await Auth.Login(username, password, clientID, scope)
    }

    async refreshToken(refreshToken: string, clientID: string): Promise<AccessToken> {
        return await Auth.RefreshToken(refreshToken, clientID);
    }
}