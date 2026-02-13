/*
 * Copyright 2020 The Backstage Authors
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

import {
  ScmIntegrationsApi,
  scmIntegrationsApiRef,
  ScmAuth,
} from '@backstage/integration-react';
import {
  AnyApiFactory,
  configApiRef,
  createApiFactory,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  oauthRequestApiRef,
} from '@backstage/core-plugin-api';
import { AuthProxyDiscoveryApi } from './AuthProxyDiscoveryApi';
import { formDecoratorsApiRef } from '@backstage/plugin-scaffolder/alpha';
import { DefaultScaffolderFormDecoratorsApi } from '@backstage/plugin-scaffolder/alpha';
import { mockDecorator } from './components/scaffolder/decorators';
import { scaffolderApiRef } from '@backstage/plugin-scaffolder-react';
import { ScaffolderClient } from '@backstage/plugin-scaffolder';
import { OAuth2 } from '@backstage/core-app-api';
import {
  Wso2ApiManagerClient,
  wso2ApiManagerApiRef,
  wso2AuthApiRef,
  thunderAuthApiRef,
} from '@internal/plugin-wso2-api-manager';

export const apis: AnyApiFactory[] = [
  createApiFactory({
    api: discoveryApiRef,
    deps: { configApi: configApiRef },
    factory: ({ configApi }) => AuthProxyDiscoveryApi.fromConfig(configApi),
  }),
  createApiFactory({
    api: scmIntegrationsApiRef,
    deps: { configApi: configApiRef },
    factory: ({ configApi }) => ScmIntegrationsApi.fromConfig(configApi),
  }),

  createApiFactory({
    api: scaffolderApiRef,
    deps: {
      discoveryApi: discoveryApiRef,
      fetchApi: fetchApiRef,
      scmIntegrationsApi: scmIntegrationsApiRef,
      identityApi: identityApiRef,
    },
    factory: ({ discoveryApi, fetchApi, scmIntegrationsApi, identityApi }) =>
      new ScaffolderClient({
        useLongPollingLogs: true,
        discoveryApi,
        fetchApi,
        scmIntegrationsApi,
        identityApi,
      }),
  }),

  createApiFactory({
    api: formDecoratorsApiRef,
    deps: {},
    factory: () =>
      DefaultScaffolderFormDecoratorsApi.create({
        decorators: [mockDecorator],
      }),
  }),

  createApiFactory({
    api: wso2ApiManagerApiRef,
    deps: {
      discoveryApi: discoveryApiRef,
      fetchApi: fetchApiRef,
    },
    factory: ({ discoveryApi, fetchApi }) =>
      new Wso2ApiManagerClient({ discoveryApi, fetchApi }),
  }),

  createApiFactory({
    api: wso2AuthApiRef,
    deps: {
      discoveryApi: discoveryApiRef,
      oauthRequestApi: oauthRequestApiRef,
      configApi: configApiRef,
    },
    factory: ({ discoveryApi, oauthRequestApi, configApi }) =>
      OAuth2.create({
        discoveryApi,
        oauthRequestApi,
        provider: {
          id: 'oidc',
          title: 'Asgardeo Auth',
          icon: () => null,
        },
        environment: configApi.getOptionalString('auth.environment'),
        defaultScopes: ['openid', 'profile', 'email'],
      }),
  }),

  createApiFactory({
    api: thunderAuthApiRef,
    deps: {
      discoveryApi: discoveryApiRef,
      oauthRequestApi: oauthRequestApiRef,
      configApi: configApiRef,
    },
    factory: ({ discoveryApi, oauthRequestApi, configApi }) =>
      OAuth2.create({
        discoveryApi,
        oauthRequestApi,
        provider: {
          id: 'oidc',
          title: 'Thunder Auth',
          icon: () => null,
        },
        environment: configApi.getOptionalString('auth.environment'),
        defaultScopes: ['openid', 'profile', 'email'],
      }),
  }),

  ScmAuth.createDefaultApiFactory(),
];
