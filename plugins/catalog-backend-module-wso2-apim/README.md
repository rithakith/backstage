# @rk-apim/backstage-plugin-catalog-backend-module-wso2-apim

This is a catalog module for the **WSO2 API Manager** integration. It provides an `EntityProvider` that automatically discovers and ingests APIs, API Products, and MCP Servers from WSO2 into the Backstage Catalog.

## 🚀 Installation

```bash
yarn workspace backend add @rk-apim/backstage-plugin-catalog-backend-module-wso2-apim
```

## ⚙️ Configuration (`app-config.yaml`)

```yaml
# 1. Main WSO2 Plugin Configuration
wso2ApiManager:
  baseUrl: https://<WSO2_HOST>:<PORT>
  # ...

# 2. Catalog Discovery Configuration
catalog:
  providers:
    # Asgardeo is used as an example; any standard OIDC provider can be used here.
    asgardeo:
      roleAttribute: asgardeo_role
    wso2Apim:
      baseUrl: https://<WSO2_HOST>:<PORT>
      namespace: wso2
```

## 🏗️ Setup

In your `packages/backend/src/index.ts`:

```typescript
const backend = createBackend();

// ...
backend.add(import('@rk-apim/backstage-plugin-catalog-backend-module-wso2-apim'));
// ...

backend.start();
```

## 📜 License
Apache-2.0
