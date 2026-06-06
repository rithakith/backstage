export interface Wso2Service {
  id: string;
  name: string;
  description?: string;
  version?: string;
  serviceKey?: string;
  serviceUrl?: string;
  definitionType?: string;
  securityType?: string;
  mutualSSLEnabled?: boolean;
  usage?: number;
  createdTime?: string;
  lastUpdatedTime?: string;
  md5?: string;
  definitionUrl?: string;
}
