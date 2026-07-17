# Entity Model and Annotations

The WSO2 catalog module maps several WSO2 resource types into Backstage `API` entities.

The frontend depends heavily on annotations from these entities. Treat the annotations as a contract between the catalog backend module and frontend components.

## Entity Types

| WSO2 source | Backstage kind | `spec.type` | Main flag annotation |
| --- | --- | --- | --- |
| WSO2 API | `API` | Derived from API type | `wso2.com/api-id` |
| WSO2 API Product | `API` | `api_product` | `wso2.com/is-api-product: true` |
| WSO2 MCP Server | `API` | `mcp` | `wso2.com/is-mcp-server: true` |
| WSO2 Service Catalog service | `API` | `service` | `wso2.com/is-service: true` |
| Self-hosted gateway-discovered API | `API` | Derived from discovered API/spec type | `wso2.com/api-discovery-type: self-hosted-gateway` |

## Normal Entity Naming

API and product names are normalized by replacing non-alphanumeric characters with hyphens, trimming hyphens, collapsing repeated hyphens, and lowercasing with `en-US` locale.

If the normalized API name is empty, it falls back to:

```text
unknown
```

Gateway-discovered APIs use:

```text
{normalized-display-name}-{normalized-discovered-from}
```

and are placed in namespace:

```text
wso2-gateways
```

## Common API Annotations

Regular WSO2 APIs include:

| Annotation | Source/purpose |
| --- | --- |
| `wso2.com/api-id` | WSO2 API id. |
| `wso2.com/api-name` | WSO2 API name. |
| `wso2.com/api-version` | WSO2 API version. |
| `wso2.com/api-context` | API context. |
| `wso2.com/api-provider` | Provider. |
| `wso2.com/api-type` | WSO2 API type. |
| `wso2.com/api-lifecycle-status` | Lifecycle status. |
| `wso2.com/api-gateway` | Gateway type/vendor value. |
| `wso2.com/is-discovered` | `true` when `initiatedFromGateway === true`; otherwise `false`. |
| `wso2.com/api-documents` | JSON string of WSO2 document metadata. |
| `wso2.com/api-endpoints` | JSON string of WSO2 endpoint URLs. |
| `wso2.com/gateway-endpoints` | JSON string reconstructed from Publisher settings and deployment data. |
| `wso2.com/raw-endpoint-urls` | JSON string of raw endpoint URL data. |
| `wso2.com/platform-gateway-endpoints` | JSON string generated from configured platform gateways when present. |
| `wso2.com/api-throttling-policy` | API throttling policy. |
| `wso2.com/api-transports` | JSON string of transports. |
| `wso2.com/api-visibility` | API visibility. |
| `wso2.com/api-security-scheme` | JSON string or serialized security scheme value. |
| `wso2.com/api-authorization-header` | Authorization header name. |
| `wso2.com/api-key-header` | API key header name. |
| `wso2.com/api-max-tps` | Max TPS as a string. |
| `wso2.com/api-policies` | JSON string of policies. |

## API Product Annotations

API products include the common API identity annotations plus:

| Annotation | Purpose |
| --- | --- |
| `wso2.com/is-api-product` | Always `true` for API product entities. |
| `wso2.com/product-resources` | JSON string of API product resources. |
| `wso2.com/business-owner` | Business owner. |
| `wso2.com/business-owner-email` | Business owner email. |
| `wso2.com/technical-owner` | Technical owner. |
| `wso2.com/technical-owner-email` | Technical owner email. |

The product mapper sets:

```text
wso2.com/api-type: API_PRODUCT
```

## MCP Server Annotations

MCP server entities include:

| Annotation | Purpose |
| --- | --- |
| `wso2.com/api-id` | MCP server id. |
| `wso2.com/api-name` | MCP server name. |
| `wso2.com/api-version` | MCP version. |
| `wso2.com/api-context` | MCP context. |
| `wso2.com/api-provider` | Provider. |
| `wso2.com/api-lifecycle-status` | Lifecycle status. |
| `wso2.com/api-type` | Always `MCP`. |
| `wso2.com/is-mcp-server` | Always `true`. |
| `wso2.com/mcp-tools` | JSON string of MCP tools. |
| `wso2.com/api-documents` | JSON string of document metadata. |

## Service Annotations

Service Catalog entities include:

| Annotation | Purpose |
| --- | --- |
| `wso2.com/is-service` | Always `true`. |
| `wso2.com/service-id` | Service id. |
| `wso2.com/service-name` | Service name. |
| `wso2.com/service-version` | Service version. |
| `wso2.com/service-url` | Service URL. |
| `wso2.com/service-definition-type` | Definition type. |

The current service mapper sets `spec.owner` to `unknown`.

## Gateway-Discovered API Annotations

Gateway-discovered APIs include:

| Annotation | Purpose |
| --- | --- |
| `wso2-gateway.com/api-id` | Gateway API id. |
| `wso2-gateway.com/api-name` | Gateway API display name. |
| `wso2-gateway.com/api-version` | Version from gateway spec, defaulting to `1.0.0`. |
| `wso2-gateway.com/api-context` | Context from gateway spec, defaulting to `/`. |
| `wso2-gateway.com/discovered-from` | Gateway name. |
| `wso2-gateway.com/api-endpoints` | JSON endpoint list from gateway URLs and context. |
| `wso2.com/api-id` | Compatibility id. |
| `wso2.com/organization-id` | Organization id when present. |
| `wso2.com/api-discovery-type` | `self-hosted-gateway`. |
| `wso2.com/api-gateway-vendor` | Normalized gateway vendor. |
| `wso2.com/is-discovered` | Current mapper sets this to `false`. |
| `wso2.com/api-documents` | JSON string of document metadata. |

Review note: the gateway mapper sets `wso2.com/is-discovered` to `false` even though these entities are discovered from gateways. Confirm whether the frontend expects this exact value or whether it should be changed.

## Frontend Fallback Prefix

Some frontend code supports both:

- `wso2.com/*`
- `wso2-gateway.com/*`

When adding new annotations, prefer `wso2.com/*` for canonical WSO2 APIM catalog data and use `wso2-gateway.com/*` for gateway-discovered source-specific fields.
