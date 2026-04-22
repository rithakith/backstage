# @rk-apim/backstage-plugin-wso2-api-manager-backend

This is the backend plugin for **WSO2 API Manager** in Backstage. It provides the proxy API and authentication logic required by the frontend plugin.

## 🚀 Installation

```bash
yarn workspace backend add @rk-apim/backstage-plugin-wso2-api-manager-backend
```

## ⚙️ Configuration (`app-config.yaml`)

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

# 2. Authentication Providers
auth:
  providers:
    # Example IDP Configuration (Any standard OIDC provider can be used)
    oidc:
      development:
        clientId: <IDP_CLIENT_ID>
        # ...
    # WSO2 API Manager OAuth provider
    wso2apim:
      development:
        clientId: ${WSO2_APIM_CLIENT_ID}
        # ...
```

## 🏗️ Setup

In your `packages/backend/src/index.ts`:

```typescript
const backend = createBackend();

// ...
backend.add(import('@rk-apim/backstage-plugin-wso2-api-manager-backend'));
// ...

backend.start();
```

## 📜 License
Apache-2.0
