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
  ApiRef,
  BackstageIdentityApi,
  configApiRef,
  createApiFactory,
  createApiRef,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
  oauthRequestApiRef,
  OpenIdConnectApi,
  ProfileInfoApi,
  SessionApi,
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
} from '@rk-apim-1/backstage-plugin-wso2-api-manager';

export const asgardeoAuthApiRef: ApiRef<
  OpenIdConnectApi & ProfileInfoApi & BackstageIdentityApi & SessionApi
> = createApiRef({
  id: 'auth.asgardeo',
});

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
    api: asgardeoAuthApiRef,
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
          title: 'Asgardeo',
          icon: () => null,
        },
        environment: configApi.getOptionalString('auth.environment'),
        defaultScopes: ['openid', 'profile', 'email'],
      }),
  }),

  // WSO2 API Manager auth - uses the same Asgardeo/OIDC session as Backstage login
  // The Asgardeo token is forwarded to WSO2 APIM (requires WSO2 to trust Asgardeo as IdP)
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
          id: 'oidc',  // Use the same OIDC provider as Backstage login (Asgardeo)
          title: 'Asgardeo',
          icon: () => null,
        },
        environment: configApi.getOptionalString('auth.environment'),
        // Request API Manager scopes - these must be configured in Asgardeo app
        defaultScopes: ['openid', 'profile', 'email'],
      }),
  }),



  ScmAuth.createDefaultApiFactory(),
];
