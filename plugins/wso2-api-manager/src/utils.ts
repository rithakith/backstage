import { Entity } from '@backstage/catalog-model';

/**
 * Checks if the entity is a WSO2 API based on the existence of the 'wso2.com/api-id' annotation.
 */
export const isWso2Api = (entity: Entity) => Boolean(entity.metadata.annotations?.['wso2.com/api-id']);

/**
 * Checks if the entity is an MCP server based on the 'wso2.com/is-mcp-server' annotation.
 */
export const isMcpEntity = (entity: Entity) => entity.metadata.annotations?.['wso2.com/is-mcp-server'] === 'true';

/**
 * Checks if the entity has multiple component relations.
 */
export const hasMultipleComponentRelations = (entity: Entity) => {
  const componentRelations = entity.relations?.filter(r => r.type.includes('api') && r.targetRef.startsWith('component:')) || [];
  return componentRelations.length > 1;
};
