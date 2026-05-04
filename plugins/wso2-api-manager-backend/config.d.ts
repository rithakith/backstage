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
    /**
     * The timeout in seconds for the catalog synchronization polling.
     * @visibility frontend
     */
    catalogSyncTimeoutSeconds?: number;
  };
  /**
   * Configuration for self-hosted WSO2 API Platform Gateways.
   * @visibility frontend
   */
  wso2PlatformGateway?: Array<{
    name: string;
    urls: string[];
    /** @visibility frontend */
    discoveryUrl?: string;
    /** @visibility frontend */
    discoveryAuth?: string;
    environmentType?: string;
    description?: string;
    organizationId?: string;
  }>;
}
