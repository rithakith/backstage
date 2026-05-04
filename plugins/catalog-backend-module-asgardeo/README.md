# @rk-apim-1/backstage-plugin-catalog-backend-module-asgardeo

This is an optional catalog module for **Asgardeo** integration in Backstage. It providing an `EntityProvider` that syncs Users and Groups from Asgardeo into the Backstage Catalog.

## 🚀 Installation

This module is **optional**. Only install it if you want to sync your organization's identity from Asgardeo.

```bash
yarn workspace backend add @rk-apim-1/backstage-plugin-catalog-backend-module-asgardeo
```

## ⚙️ Configuration (`app-config.yaml`)

```yaml
catalog:
  providers:
    asgardeo:
      baseUrl: https://api.asgardeo.io/t/<YOUR_ORG>
      clientId: ${ASGARDEO_CLIENT_ID}
      clientSecret: ${ASGARDEO_CLIENT_SECRET}
      # The attribute in Asgardeo that maps to Backstage roles
      roleAttribute: asgardeo_role
      schedule:
        frequency: { minutes: 30 }
        timeout: { minutes: 3 }
```

## 🏗️ Setup

In your `packages/backend/src/index.ts`:

```typescript
const backend = createBackend();

// ...
backend.add(import('@rk-apim-1/backstage-plugin-catalog-backend-module-asgardeo'));
// ...

backend.start();
```

## 📜 License
Apache-2.0
