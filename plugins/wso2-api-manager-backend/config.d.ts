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
      /** @visibility secret */
      clientId: string;
      /** @visibility secret */
      clientSecret: string;
    };
  };
}
