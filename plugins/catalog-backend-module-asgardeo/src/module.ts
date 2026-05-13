/*
 * Copyright 2026 WSO2 LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createBackendModule, coreServices, readSchedulerServiceTaskScheduleDefinitionFromConfig } from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
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
                logger.info('Initializing Asgardeo User/Group Provider...');
                const provider = AsgardeoEntityProvider.fromConfig(config, {
                    id: 'asgardeo',
                    logger,
                });
                catalog.addEntityProvider(provider);
                logger.info('Asgardeo Provider added. Scheduling sync...');

                const defaultSchedule = {
                    frequency: { minutes: 30 },
                    timeout: { minutes: 5 },
                    initialDelay: { seconds: 5 },
                };

                const schedule = config.has('catalog.providers.asgardeo.schedule')
                    ? readSchedulerServiceTaskScheduleDefinitionFromConfig(
                        config.getConfig('catalog.providers.asgardeo.schedule'),
                    )
                    : defaultSchedule;

                const taskRunner = scheduler.createScheduledTaskRunner(schedule);

                taskRunner.run({
                    id: provider.getProviderName(),
                    fn: async () => {
                        await provider.run();
                    },
                });
            },
        });
    },
});
