# WSO2 API Manager Backend Plugin

The WSO2 API Manager Backend Plugin provides a secure proxy to the WSO2 API Manager Publisher and Gateway APIs, handling authentication and bypassing CORS restrictions.

## Installation

1. Install the package in your Backstage backend:

```bash
yarn workspace backend add @rk-apim/backstage-plugin-wso2-api-manager-backend
```

2. Register the plugin in `packages/backend/src/index.ts`:

```typescript
const backend = createBackend();

// ...
backend.add(import('@rk-apim/backstage-plugin-wso2-api-manager-backend'));
// ...

backend.start();
```

3. Configure the plugin in `app-config.yaml`:

```yaml
wso2:
  baseUrl: https://your-wso2-apim-instance:9443
  username: ${WSO2_USERNAME}
  password: ${WSO2_PASSWORD}
  # Optional: For MCP server interactions
  mcp:
    enabled: true
```

## Features

- **Secure Proxy**: Forwards requests to WSO2 APIs with service-account credentials.
- **Endpoint Discovery**: Automatically resolves gateway URLs for ingested APIs.
- **MCP Action Support**: Provides tools for interacting with APIs as Model Context Protocol servers.
