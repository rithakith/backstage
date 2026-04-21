# WSO2 API Manager Catalog Module

The WSO2 API Manager Catalog Module automatically ingests APIs and API Products from WSO2 API Manager into the Backstage Software Catalog.

## Installation

1. Install the package in your Backstage backend:

```bash
yarn workspace backend add @rk-apim/backstage-plugin-catalog-backend-module-wso2-apim
```

2. Register the module in `packages/backend/src/index.ts`:

```typescript
const backend = createBackend();

// ...
backend.add(import('@rk-apim/backstage-plugin-catalog-backend-module-wso2-apim'));
// ...

backend.start();
```

3. Configure the provider in `app-config.yaml`:

```yaml
catalog:
  providers:
    wso2Apim:
      dev:
        baseUrl: https://dev.wso2-apim.com:9443
        schedule:
          frequency: { minutes: 30 }
          timeout: { minutes: 3 }
```

## Features

- **Automated Ingestion**: Syncs all published APIs and API Products.
- **Rich Metadata**: Maps WSO2 tags, descriptions, and documentation to Backstage entities.
- **Multi-Environment Support**: Configure multiple providers for different WSO2 environments.
- **MCP Server Annotations**: Automatically marks entities as MCP-enabled if relevant.
