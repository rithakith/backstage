# @rk-apim/backstage-plugin-wso2-api-manager

This plugin provides the frontend integration for **WSO2 API Manager** in Backstage. It includes a comprehensive dashboard for browsing APIs, API Products, and MCP Servers, as well as specialized Catalog cards for API entities.

## 📋 Prerequisites

Before installing the plugins, ensure your environment meets the Backstage requirements:

### 1. Node.js and Tools
We recommend using **Node.js 24** (the latest LTS for Backstage). You can install it via [nvm](https://github.com/nvm-sh/nvm):

```bash
# Install Node.js 24
nvm install 24
nvm use 24
```

### 2. System Dependencies (Linux)
Backstage requires several system tools to build native modules:

```bash
sudo apt update && sudo apt install -y build-essential python3 python3-pip g++ make
```

---

## 🚀 Full Suite Integration Guide

For the full WSO2 experience, you should install the complete suite of plugins:
1. `@rk-apim/backstage-plugin-wso2-api-manager` (This package)
2. `@rk-apim/backstage-plugin-wso2-api-manager-backend`
3. `@rk-apim/backstage-plugin-catalog-backend-module-wso2-apim`
4. `@rk-apim/backstage-plugin-catalog-backend-module-asgardeo` (Optional: for User/Group syncing)

### 1. Installation

```bash
# Frontend
yarn workspace app add @rk-apim/backstage-plugin-wso2-api-manager

# Backend
yarn workspace backend add @rk-apim/backstage-plugin-wso2-api-manager-backend @rk-apim/backstage-plugin-catalog-backend-module-wso2-apim
```

#### Verification
To verify the installation is successful, check your `package.json` files for the following entries:
- **Frontend**: Check `packages/app/package.json` for `@rk-apim/backstage-plugin-wso2-api-manager`.
- **Backend**: Check `packages/backend/package.json` for `@rk-apim/backstage-plugin-wso2-api-manager-backend`, etc.

If listed, the plugins are correctly integrated into your workspace and ready for setup.

### 2. Configuration (`app-config.yaml`)

```yaml
# 1. Main WSO2 Plugin Configuration
wso2ApiManager:
  baseUrl: https://<WSO2_HOST>:<PORT>
  devportalBasePath: /api/am/devportal/v3
  publisherBasePath: /api/am/publisher/v4
  tls:
    rejectUnauthorized: false
  auth:
    # Service account credentials for server-side operations
    clientId: <WSO2_SERVICE_ACCOUNT_CLIENT_ID>
    clientSecret: <WSO2_SERVICE_ACCOUNT_CLIENT_SECRET>
    tokenUrl: https://<WSO2_HOST>:<PORT>/oauth2/token
    grantType: jwt-bearer

# 2. Catalog Discovery Configuration
catalog:
  providers:
    # Asgardeo is used as an example; any standard OIDC provider can be used here.
    asgardeo:
      roleAttribute: asgardeo_role
    wso2Apim:
      baseUrl: https://<WSO2_HOST>:<PORT>
      namespace: wso2

# 3. Authentication Providers
auth:
  environment: development
  session:
    secret: <YOUR_SESSION_SECRET_32_CHARS>
  providers:
    # Example IDP Configuration (e.g., Asgardeo/Okta/Auth0)
    oidc:
      development:
        clientId: <IDP_CLIENT_ID>
        clientSecret: <IDP_CLIENT_SECRET>
        metadataUrl: <IDP_METADATA_URL>
        additionalScopes: 'apim:api_create apim:api_publish'
        prompt: login
    # WSO2 API Manager OAuth provider - for accessing DevPortal APIs with user identity
    wso2apim:
      development:
        clientId: ${WSO2_APIM_CLIENT_ID}
        clientSecret: ${WSO2_APIM_CLIENT_SECRET}
        metadataUrl: https://<WSO2_HOST>:<PORT>/oauth2/token/.well-known/openid-configuration
        additionalScopes: 'apim:subscribe apim:api_view apim:mcp_server_view apim:mcp_server_create apim:mcp_server_publish apim:mcp_server_generate_key apim:llm_provider_read'
        prompt: login
```

### 3. Frontend Setup

#### Register API Client
In `packages/app/src/apis.ts` (if it exists) or directly in `packages/app/src/App.tsx`:

```typescript
import {
  wso2ApiManagerApiRef,
  Wso2ApiManagerClient,
} from '@rk-apim/backstage-plugin-wso2-api-manager';

export const apis: AnyApiFactory[] = [
  // ... existing APIs
  createApiFactory({
    api: wso2ApiManagerApiRef,
    deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
    factory: ({ discoveryApi, fetchApi }) =>
      new Wso2ApiManagerClient({ discoveryApi, fetchApi }),
  }),
];
```

> [!NOTE]
> If your Backstage installation does not have an `apis.ts` file, you can pass the `apis` array directly to the `createApp` function in `App.tsx`.


#### Add the Route
In `packages/app/src/App.tsx`:

```typescript
import { Wso2ApiManagerPage } from '@rk-apim/backstage-plugin-wso2-api-manager';

// ...
<Route path="/wso2-api-manager" element={<Wso2ApiManagerPage />} />
```

#### Add Catalog Cards
In `packages/app/src/components/catalog/EntityPage.tsx`:

```typescript
import {
  EntityWso2ApiOverviewCard,
  EntityWso2ApiDefinitionCard,
  isWso2Api
} from '@rk-apim/backstage-plugin-wso2-api-manager';

// Add to your API entity layout
<EntitySwitch.Case if={isWso2Api}>
  <Grid item md={6}>
    <EntityWso2ApiOverviewCard />
  </Grid>
  <Grid item md={12}>
    <EntityWso2ApiDefinitionCard />
  </Grid>
    </EntitySwitch.Case>
</EntitySwitch>
```

### 4. Backend Setup

In your `packages/backend/src/index.ts`:

```typescript
const backend = createBackend();

// Add the WSO2 Backend plugin
backend.add(import('@rk-apim/backstage-plugin-wso2-api-manager-backend'));

// Add the Catalog module for WSO2 discovery
backend.add(import('@rk-apim/backstage-plugin-catalog-backend-module-wso2-apim'));

// Optional: Add the Asgardeo Catalog module for User/Group syncing
// backend.add(import('@rk-apim/backstage-plugin-catalog-backend-module-asgardeo'));

backend.start();
```

### 5. Optional: Asgardeo Integration

If you use Asgardeo for identity management, you can install the optional catalog module to sync Users and Groups:

```bash
# Install the module
yarn workspace backend add @rk-apim/backstage-plugin-catalog-backend-module-asgardeo
```

Then add it to your `packages/backend/src/index.ts` as shown in the commented section above.

## 📜 License
Apache-2.0
