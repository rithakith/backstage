# Configuration

This page gives user-facing configuration guidance. For source-level config behavior and mismatches, use [Developer Configuration Reference](../developer-docs/09-configuration-reference.md).

## WSO2 API Manager

Use `wso2ApiManager` to tell Backstage how to reach WSO2 API Manager.

Example:

```yaml
wso2ApiManager:
  baseUrl: https://example.wso2.com
  publisherBasePath: /api/am/publisher/v4
  developerBasePath: /api/am/devportal/v3
  serviceCatalogBasePath: /api/am/service-catalog/v1
  tls:
    rejectUnauthorized: true
  auth:
    clientId: ${WSO2_CLIENT_ID}
    clientSecret: ${WSO2_CLIENT_SECRET}
    tokenUrl: https://example.wso2.com/oauth2/token
```

Important fields:

| Field | Purpose |
| --- | --- |
| `baseUrl` | Base WSO2 API Manager URL. |
| `publisherBasePath` | Used for API, product, MCP, settings, documents, revisions, and WSDL operations. |
| `developerBasePath` | Used for DevPortal operations such as API key generation. |
| `serviceCatalogBasePath` | Used for WSO2 Service Catalog operations. |
| `auth.clientId` | OAuth client ID for service-account access. |
| `auth.clientSecret` | OAuth client secret for service-account access. |
| `auth.tokenUrl` | OAuth token endpoint. |
| `tls.rejectUnauthorized` | Controls TLS certificate verification. Defaults to `true` where implemented. |

## WSO2 Catalog Provider

Use `catalog.providers.wso2Apim` to schedule catalog ingestion.

Example:

```yaml
catalog:
  providers:
    wso2Apim:
      namespace: default
      schedule:
        frequency: { minutes: 30 }
        timeout: { minutes: 5 }
        initialDelay: { seconds: 5 }
```

Fields:

| Field | Purpose |
| --- | --- |
| `namespace` | Catalog namespace for generated entities. Defaults to `default` in the inspected source. |
| `schedule` | How often Backstage syncs WSO2 data into the catalog. |

## Self-Hosted Gateways

Use `wso2PlatformGateway` to show or discover self-hosted WSO2 gateways.

Example:

```yaml
wso2PlatformGateway:
  - name: production-gateway
    urls:
      - https://gateway.example.com
    discoveryUrl: https://gateway.example.com/discovery
    discoveryUsername: ${WSO2_GATEWAY_DISCOVERY_USERNAME}
    discoveryPassword: ${WSO2_GATEWAY_DISCOVERY_PASSWORD}
    environmentType: PRODUCTION
    description: Production self-hosted gateway
    organizationId: example-org
```

Fields:

| Field | Purpose |
| --- | --- |
| `name` | Gateway name shown in Backstage. |
| `urls` | Gateway base URLs used for display and endpoint construction. |
| `discoveryUrl` | Optional endpoint for direct gateway API discovery. |
| `discoveryUsername` | Optional or required depending on backend path. Used for discovery Basic auth. |
| `discoveryPassword` | Optional or required depending on backend path. Used for discovery Basic auth. |
| `environmentType` | Gateway environment type. |
| `description` | User-facing gateway description. |
| `organizationId` | Organization id added to discovered API metadata where available. |

## Asgardeo Catalog Provider

Use `catalog.providers.asgardeo` when Backstage should sync users and groups from Asgardeo.

Example:

```yaml
catalog:
  providers:
    asgardeo:
      organization: example-org
      schedule:
        frequency: { minutes: 30 }
        timeout: { minutes: 5 }
        initialDelay: { seconds: 5 }
```

## Asgardeo Sign-In

The Asgardeo auth module registers provider id:

```text
asgardeo
```

The module uses Backstage's OIDC auth behavior. Configure the auth provider according to the Backstage OIDC provider pattern used in your app.

Supported sign-in resolver factories are:

- `emailLocalPartMatchingUserEntityName`
- `emailMatchingUserEntityProfileEmail`

## TLS Guidance

Use:

```yaml
tls:
  rejectUnauthorized: true
```

for production.

Use `false` only in controlled development environments where the WSO2 endpoint uses a self-signed or otherwise untrusted certificate and the risk is understood.
