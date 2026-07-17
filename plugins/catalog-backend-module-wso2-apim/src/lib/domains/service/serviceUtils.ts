import { LoggerService } from '@backstage/backend-plugin-api';
import { Wso2Client } from '../../Wso2Client';
import { Wso2Service } from './types';

function formatDuration(durationMs: number): string {
  return `${durationMs}ms (${(durationMs / 1000).toFixed(2)}s)`;
}

export async function fetchServiceList(
  client: Wso2Client,
  logger: LoggerService,
): Promise<Wso2Service[]> {
  const startedAt = Date.now();
  const basePath = client.getServiceCatalogBasePath();
  logger.info(`[Wso2Fetchers] Fetching Services from ${basePath}/services`);
  try {
    const data = await client.get<any>(`${basePath}/services?limit=1000&offset=0`);
    const serviceList = data.list || [];
    logger.info(
      `[Wso2Fetchers] Retrieved ${serviceList.length} Services from Catalog.`,
    );
    logger.info(
      `[WSO2 Timing] Services loaded: ${serviceList.length} services in ${formatDuration(
        Date.now() - startedAt,
      )}.`,
    );
    return serviceList;
  } catch (error) {
    logger.error(`[Wso2Fetchers] Error fetching Services: ${error}`);
  }
  return [];
}
