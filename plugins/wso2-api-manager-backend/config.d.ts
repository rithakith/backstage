export interface Config {
  wso2ApiManager?: {
    baseUrl: string;
    devportalBasePath?: string;
    publisherBasePath?: string;
    tls?: {
      rejectUnauthorized?: boolean;
    };
    auth: {
      tokenUrl?: string;
      grantType?: 'client_credentials' | 'password';
      scopes?: string[];
      /** @visibility secret */
      username?: string;
      /** @visibility secret */
      password?: string;
      /** @visibility secret */
      clientId: string;
      /** @visibility secret */
      clientSecret: string;
    };
  };
}
