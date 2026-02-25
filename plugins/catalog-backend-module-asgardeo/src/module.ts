import { createBackendModule, coreServices } from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import { AsgardeoEntityProvider } from './providers/AsgardeoEntityProvider';

export const catalogModuleAsgardeoEntityProvider = createBackendModule({
    pluginId: 'catalog',
    moduleId: 'asgardeo-entity-provider',
    register(reg) {
        reg.registerInit({
            deps: {
                catalog: catalogProcessingExtensionPoint,
                config: coreServices.rootConfig,
                logger: coreServices.logger,
                scheduler: coreServices.scheduler,
            },
            async init({ catalog, config, logger, scheduler }) {
                const provider = new AsgardeoEntityProvider({
                    id: 'asgardeo',
                    config,
                    logger,
                });
                catalog.addEntityProvider(provider);

                await scheduler.scheduleTask({
                    id: 'run_asgardeo_refresh',
                    fn: async () => {
                        await provider.run();
                    },
                    frequency: { minutes: 30 },
                    timeout: { minutes: 5 },
                    initialDelay: { seconds: 5 },
                });
            },
        });
    },
});
