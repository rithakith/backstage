import { createBackendModule, coreServices } from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import { Wso2ApiEntityProvider } from './providers/Wso2ApiEntityProvider';

export const catalogModuleWso2Apim = createBackendModule({
    pluginId: 'catalog',
    moduleId: 'wso2-apim',
    register(reg) {
        reg.registerInit({
            deps: {
                catalog: catalogProcessingExtensionPoint,
                config: coreServices.rootConfig,
                logger: coreServices.logger,
                scheduler: coreServices.scheduler,
            },
            async init({ catalog, config, logger, scheduler }) {
                logger.info('Initializing WSO2 API Catalog Module');

                // Instantiate the provider
                const provider = new Wso2ApiEntityProvider({
                    id: 'wso2-publisher-apis',
                    config,
                    logger,
                });

                // Add the provider to the catalog
                catalog.addEntityProvider(provider);

                // Schedule the provider to run periodically
                const schedule = scheduler.createScheduledTaskRunner({
                    frequency: { minutes: 1 }, // Run every 1 minute for testing/demo purposes; usually { hours: 1 }
                    timeout: { minutes: 5 },
                    initialDelay: { seconds: 15 }, // Wait a bit before first run
                });

                // Run the scheduled task
                schedule.run({
                    id: provider.getProviderName(),
                    fn: async () => {
                        await provider.run();
                    },
                });

                logger.info('WSO2 API Catalog Module Initialized Successfully');
            },
        });
    },
});

export default catalogModuleWso2Apim;
