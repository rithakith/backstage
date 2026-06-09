import { Entity } from '@backstage/catalog-model';
import type { Wso2Service } from './types';

export function mapWso2ServiceToEntity(
  service: Wso2Service,
  namespace: string,
  providerId: string,
): Entity {
  const entityName = (service.name || 'unknown')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .toLocaleLowerCase('en-US');

  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'API',
    metadata: {
      name: entityName,
      namespace,
      description: service.description || `Service ${service.name}`,
      annotations: {
        'wso2.com/is-service': 'true',
        'wso2.com/service-id': service.id,
        'wso2.com/service-name': service.name,
        'wso2.com/service-version': service.version || '',
        'wso2.com/service-url': service.serviceUrl || '',
        'wso2.com/service-definition-type': service.definitionType || '',
        'backstage.io/managed-by-location': `wso2-provider:${providerId}`,
        'backstage.io/managed-by-origin-location': `wso2-provider:${providerId}`,
      },
    },
    spec: {
      type: 'service',
      lifecycle: 'production',
      owner: 'unknown',
      definition: service.description || 'WSO2 Service Definition placeholder',
    },
  };
}
