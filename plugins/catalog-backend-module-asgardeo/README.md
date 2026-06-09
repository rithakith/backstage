# @local/backstage-plugin-catalog-backend-module-asgardeo

This optional catalog module syncs users and groups from Asgardeo into the Backstage Catalog.

## Installation

Install this module only when Backstage should ingest organization identity data from Asgardeo.

```bash
yarn workspace backend add @local/backstage-plugin-catalog-backend-module-asgardeo
```

## Configuration (`app-config.yaml`)

```yaml
catalog:
  providers:
    asgardeo:
      organization: <YOUR_ORG>
      baseUrl: https://api.asgardeo.io/t/<YOUR_ORG>
      clientId: ${ASGARDEO_CLIENT_ID}
      clientSecret: ${ASGARDEO_CLIENT_SECRET}
      schedule:
        frequency: { minutes: 30 }
        timeout: { minutes: 5 }
        initialDelay: { seconds: 5 }
```

`organization`, `clientId`, and `clientSecret` are required. `baseUrl` is optional and defaults to `https://api.asgardeo.io/t/<organization>`.

Optional operational settings:

```yaml
catalog:
  providers:
    asgardeo:
      requestTimeoutMs: 15000
      retries: 2
```

## Setup

In `packages/backend/src/index.ts`:

```typescript
const backend = createBackend();

backend.add(import('@local/backstage-plugin-catalog-backend-module-asgardeo'));

backend.start();
```

## License

Apache-2.0
