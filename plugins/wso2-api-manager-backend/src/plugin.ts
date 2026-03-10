import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './service/router';

export const wso2ApiManagerPlugin = createBackendPlugin({
  pluginId: 'wso2-api-manager',
  register(env) {
    env.registerInit({
      deps: {
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        permissions: coreServices.permissions,
        userInfo: coreServices.userInfo,
      },
      async init({ httpAuth, httpRouter, logger, config, permissions, userInfo }) {
        httpRouter.use(await createRouter({ httpAuth, logger, config, permissions, userInfo }));
        httpRouter.addAuthPolicy({
          path: '/health',
          allow: 'unauthenticated',
        });
      },
    });
  },
});
