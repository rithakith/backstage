# WSO2 API Manager Backend Plugin for Backstage


## Installation

### 1. Adding to your Monorepo

If you are extracting this plugin to a new Backstage instance, copy the `wso2-api-manager-backend` folder to your `plugins/` directory and add it to your root `package.json` workspaces:

```bash
# In your root directory
yarn add @internal/plugin-wso2-api-manager-backend
```

### 2. Backend Integration

#### New Backend System (Recommended)

Add the plugin to your `packages/backend/src/index.ts`:

```typescript
const backend = createBackend();

// ... other plugins
backend.add(import('@internal/plugin-wso2-api-manager-backend'));

backend.start();
```

#### Legacy Backend System

Add the following to `packages/backend/src/plugins/wso2.ts`:

```typescript
import { createRouter } from '@internal/plugin-wso2-api-manager-backend';
import { Router } from 'express';
import { PluginEnvironment } from '../types';

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  return await createRouter({
    logger: env.logger,
    config: env.config,
    httpAuth: env.httpAuth,
    userInfo: env.userInfo,
  });
}
```

---

## Configuration

Add the following to your `app-config.yaml`:

```yaml
wso2ApiManager:
  baseUrl: https://localhost:9445
  devportalBasePath: /api/am/devportal/v3      # Defaults to v3
  publisherBasePath: /api/am/publisher/v4      # Defaults to v4
  auth:
    clientId: ${WSO2_CLIENT_ID}
    clientSecret: ${WSO2_CLIENT_SECRET}
    tokenUrl: https://localhost:9445/oauth2/token
  tls:
    rejectUnauthorized: false                  # Set to true for production
```

### Configuration Schema

| Option | Type | Description | Default |
| :--- | :--- | :--- | :--- |
| `baseUrl` | `string` | The base URL of your WSO2 instance. | - |
| `auth.clientId` | `string` | OAuth2 Client ID from WSO2. | - |
| `auth.clientSecret` | `string` | OAuth2 Client Secret from WSO2. | - |
| `tls.rejectUnauthorized` | `boolean` | Validate SSL certificates (set `false` for self-signed certs). | `true` |
| `devportalBasePath` | `string` | Path for DevPortal REST API. | `/api/am/devportal/v3` |
| `publisherBasePath` | `string` | Path for Publisher REST API. | `/api/am/publisher/v4` |

---

## Authentication & Access

Access to WSO2 data in Backstage is strictly read-only. Any valid Backstage user can browse discovery data. 

**Interactive Features**:
- **Try it out**: Requires the user to have a valid session (e.g., via Asgardeo). The plugin automatically requests the necessary scopes (`apim:api_view`) to generate temporary internal keys for the WSO2 Gateway.
- **Administrative Actions**: Creating APIs or updating schemas must be performed directly within the WSO2 Publisher or DevPortal.

---

## Troubleshooting

### Self-Signed Certificates
If you see `DEPTH_ZERO_SELF_SIGNED_CERT` errors, ensure `tls.rejectUnauthorized` is set to `false` in your `app-config.yaml`.

### Authentication Failures
-   **401 Unauthorized**: Check if your `clientId` and `clientSecret` belong to an application with the `apim:api_view` and `apim:api_create` scopes.
-   **Token Expiry**: The client automatically manages token refreshes using the provided credentials.

---

## License
This plugin is licensed under the [Apache-2.0 License](LICENSE).
