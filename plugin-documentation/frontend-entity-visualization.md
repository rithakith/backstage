# Frontend Entity Visualization Rules

This page documents how the WSO2 API Manager frontend decides what to show for an entity.

The main source file is:

- `plugins/wso2-api-manager/src/components/EntityWso2ApiDefinitionCard/EntityWso2ApiDefinitionCard.tsx`

The main hook files are:

- `plugins/wso2-api-manager/src/components/EntityWso2ApiDefinitionCard/hooks/useWso2ApiDefinition.ts`
- `plugins/wso2-api-manager/src/components/EntityWso2ApiDefinitionCard/hooks/useWso2ApiAuth.ts`

## Primary Inputs

| Input | Source | Used for |
| --- | --- | --- |
| `wso2.com/api-id` | Entity annotation | Primary WSO2 API ID. |
| `wso2-gateway.com/api-id` | Entity annotation | Fallback WSO2 gateway API ID. |
| `wso2.com/api-discovery-type` | Entity annotation | Decides whether the entity is treated as API platform, self-hosted gateway, or standard WSO2 Publisher API. |
| `wso2.com/is-discovered` | Entity annotation | Adds discovered badge and affects Try it out availability. |
| `wso2.com/api-raw-json` | Entity annotation | Parsed into `details`. API type and metadata come from this object. |
| `entity.spec.definition` | Catalog entity spec | API definition, operations list, AsyncAPI document, GraphQL SDL, or placeholder text. |
| `wso2.com/gateway-endpoints` | Entity annotation | Standard WSO2 gateway endpoint source. |
| `wso2.com/platform-gateway-endpoints` | Entity annotation | API platform gateway endpoint source. |
| `wso2-gateway.com/api-endpoints` | Entity annotation | Self-hosted gateway endpoint source. |
| `wso2.com/api-endpoints` | Entity annotation | Fallback standard endpoint source. |

## API ID Resolution

The definition card resolves the API ID in this order:

1. `wso2.com/api-id`
2. `wso2-gateway.com/api-id`

If neither annotation exists, the card returns `null` and nothing is rendered.

This ID is used for:

- API key generation.
- Revision lookup.
- WSDL download.
- Backend calls that require an API identifier.

## Discovery Type Rules

The card reads `wso2.com/api-discovery-type`.

| Value | Meaning in current frontend logic |
| --- | --- |
| `apiplatform` | Treated as an API platform entity. Runtime API key generation is skipped. Deployment is inferred from gateway URLs. |
| `self-hosted-gateway` | Treated as a self-hosted gateway entity. Runtime API key generation is skipped. Deployment is inferred from gateway URLs. |
| Missing | Treated as a standard WSO2 Publisher API. Deployment is checked through Publisher revisions. |
| Other values | Do not trigger the API platform or self-hosted gateway branches in the definition card. |

The variable `skipKeyGeneration` is true when the entity is API platform or self-hosted gateway.

## Discovered Flag Rules

The definition card reads:

- `wso2.com/is-discovered`

The entity is considered discovered only when the annotation is exactly `true`.

When true:

- A `Discovered API` badge is displayed in the card title area.
- Try it out is disabled unless the entity is also in a key-generation-skipping category.
- Gateway key-generation error panels are not shown because the error panel is only shown for non-discovered APIs.

Important source detail: self-hosted gateway entities created by `mapDiscoveredApiToEntity` currently set `wso2.com/is-discovered` to `false`, while setting `wso2.com/api-discovery-type` to `self-hosted-gateway`. Therefore, in the current source, self-hosted gateway behavior is mainly controlled by discovery type rather than the discovered flag.

## Raw JSON Parsing

The hook reads:

- `wso2.com/api-raw-json`

If present and valid JSON, it becomes `details`.

The frontend uses `details` for:

- API type, such as `GRAPHQL`, `WS`, `SOAP`, `HTTP`, `HTTP_AI`, `ASYNC`, `SSE`, `WEBHOOK`, `WEBSUB`.
- Policies.
- Operations.
- CORS headers.
- Security schemes.
- Description and other metadata in cards.

If raw JSON is missing or invalid:

- Some tabs and conditions cannot be evaluated.
- The overview card shows an API metadata empty state.
- The definition card can still render if `spec.definition` exists, but type-specific behavior may be incomplete.

## Definition Parsing Rules

The definition hook reads `entity.spec.definition`.

Rules:

- If no definition exists, `definition` is `null`.
- If the definition is a string starting with `{`, the hook attempts `JSON.parse`.
- If JSON parsing fails, the original string is used.
- If the parsed object has `operations` or `configuration.spec.operations` and does not have `openapi` or `swagger`, it is treated as operations-only.

## Operations-Only Detection

`hasOperationsOnly` is true when:

- The definition is an object.
- The object has `operations` or `configuration.spec.operations`.
- The object does not have an `openapi` property.
- The object does not have a `swagger` property.

When operations-only is true:

- The Swagger tab label becomes `Operations`.
- `Wso2OperationsList` is rendered instead of `Wso2SwaggerConsole`.
- A synthetic OpenAPI 3.0 object is created internally so a console can be constructed when applicable.

## Operation and Policy Sources

Gateway operations are read from the parsed definition in this order:

1. `channels`
2. `operations`
3. `configuration.spec.operations`

Gateway API policies are read from:

1. `policies`
2. `configuration.spec.policies`

These values affect:

- Policies tab visibility.
- API key auth policy detection.
- Operations list rendering.
- Console behavior.

## Source Formatting Rules

The source view displays `formattedSource`.

Formatting rules:

| API type / definition shape | Formatting |
| --- | --- |
| `GRAPHQL` string | Uses the local GraphQL SDL formatter. |
| Async type string | Uses the local AsyncAPI/YAML formatter. |
| String | Rendered as-is after applicable formatting. |
| Object | `JSON.stringify(value, null, 2)`. |

Async types are:

- `ASYNC`
- `WS`
- `SSE`
- `WEBHOOK`
- `WEBSUB`

## Gateway URL Selection

Gateway URLs are built from annotations according to discovery type.

### API Platform Entity

When `wso2.com/api-discovery-type` is `apiplatform`, the frontend reads:

- `wso2.com/platform-gateway-endpoints`

### Self-Hosted Gateway Entity

When `wso2.com/api-discovery-type` is `self-hosted-gateway`, the frontend reads:

- `wso2-gateway.com/api-endpoints`

### Standard WSO2 API

For other entities, the frontend reads:

1. `wso2.com/gateway-endpoints`
2. Fallback: `wso2.com/api-endpoints`

### Sorting

Gateway environments are sorted so `PRODUCTION` environments appear before non-production environments.

Each environment is flattened into one row per URL with:

- `url`
- `description`
- `environmentName`
- `environmentType`

## Gateway URL Display Rule

`Wso2GatewayUrlDisplay` is shown when:

- The API type does not include `HTTP`.

This means the gateway URL display is hidden for types such as `HTTP` and `HTTP_AI`, because the Swagger UI server list is expected to show those URLs.

## Deployment Rules

Deployment is determined differently for standard WSO2 Publisher APIs and discovered/platform gateway APIs.

### Standard WSO2 Publisher APIs

When `wso2.com/api-discovery-type` is missing:

- The frontend calls `getRevisions(apiId, { query: 'deployed:true', token })`.
- The API is considered deployed only when the returned revision list is an array with at least one item.

### Discovered, API Platform, and Self-Hosted Gateway APIs

When `wso2.com/api-discovery-type` exists:

- The API is considered deployed when `gatewayUrls.length > 0`.

## Swagger Spec Construction

The hook builds `swaggerSpec` from `entity.spec.definition`.

Rules:

- If operations-only, it creates a minimal OpenAPI 3.0 object with empty `paths` and no servers.
- If the value is a JSON string, it parses the JSON.
- If the value is a non-JSON string, it returns the string as-is.
- If the value is an object, it deep-clones the object.

When gateway URLs exist:

- Swagger 2.0 specs get `host`, `basePath`, and `schemes` rewritten from the gateway URLs.
- OpenAPI 3.x and other object specs get `servers` overwritten with gateway URLs.

If the resulting object has no `paths`, the hook adds an empty `paths` object.

## Placeholder Detection

The definition is considered a placeholder when it is a string containing either:

- `WSO2 API Document content placeholder`
- `WSO2 Discovered API`

When placeholder is true:

- The card shows a loading state.
- The loading text says `Syncing with WSO2 Gateway...`.

## Tab Visibility Rules

| Tab | Visible when |
| --- | --- |
| `Swagger UI` / `Operations` | `details.type` is not `GRAPHQL` and is not an async type. |
| `GraphQL Console` | `details.type` is exactly `GRAPHQL`. |
| `WebSocket Console` | `details.type` is exactly `WS`. |
| `Policies` | Publisher or key-generation-skipping API and at least one policy or operation source exists. |
| `Try it out` | `hasConsoleTab` is true and `hasOperationsOnly` is false. Current source defines `hasConsoleTab` as operations-only plus object swaggerSpec with `openapi`, so this visible condition is effectively not reached for operations-only definitions because of the additional `!hasOperationsOnly` check in the tab render. |
| `View Source` | The definition is not operations-only. |
| `WSDL` | `details.type` is exactly `SOAP`. |

## Initial Active Tab Rules

The card starts with active tab `swagger`.

After details load:

- If `details.type` is `GRAPHQL`, active tab becomes `graphql`.
- Else if `details.type` is `WS`, active tab becomes `websocket`.
- Else if there is no Swagger tab:
  - It selects `policies` when policies are visible.
  - Else it selects `source` when source is visible.
  - Else it selects `wsdl` when WSDL is visible.

## Authentication Token Rules

The auth hook requests a WSO2 access token using `wso2AuthApiRef`.

Requested scopes:

- `openid`
- `profile`
- `email`
- `apim:api_view`
- `apim:api_generate_key`
- `apim:api_manage`
- `apim:subscribe`
- `apim:app_manage`
- `apim:api_key`

The token request is optional. If token retrieval fails, the hook returns `undefined` rather than throwing.

The frontend passes the token to backend calls as `X-WSO2-Access-Token`.

## API Key Generation Rules

API key generation is skipped when:

- The entity is API platform.
- The entity is self-hosted gateway.

For other entities, key generation only runs after `refreshKey` is called. It is not automatically triggered on initial render.

Generated key response fields checked:

- `apikey`
- `internalKey`

The key is stored in React state and in `apiKeyRef`.

Manual keys can be applied with `applyManualKey`.

## API Key Auth Policy Detection

The card tries to identify API key authentication policy in this order:

1. API-level policy named `api-key-auth` from `gatewayApiPolicies`.
2. Operation-level policy named `api-key-auth` from each `gatewayOperations[*].policies`.
3. Fallback policy when the API has a subscriptionless policy and an API key header.

The fallback policy shape is:

```json
{
  "name": "API Key",
  "params": {
    "in": "header",
    "key": "apikey"
  }
}
```

## API Key Header Detection

The card determines whether an API key header exists using:

1. `details.securityScheme`, when it is a non-empty array. It must include `api_key`.
2. Fallback to `details.corsConfiguration.accessControlAllowHeaders`.
3. Fallback to `details.accessControlAllowHeaders`.

If no header data exists, the card defaults to true.

If CORS headers are used, the header list must contain `apikey` case-insensitively.

## Subscriptionless Policy Detection

The card checks `details.policies`.

It treats these policy names as subscriptionless:

- `defaultsubscriptionless`
- `asyncdefaultsubscriptionless`

The comparison is lowercased and trimmed.

## API Key UI Visibility

The API key auth section is shown in Swagger, GraphQL, and WebSocket views when all of these are true:

- API is deployed.
- API is not discovered.
- Key generation is not skipped.
- A subscriptionless policy exists.
- API key header detection is true.

## Try It Out Availability

The Swagger console receives a plugin override that disables Try it out unless all conditions pass.

Try it out is allowed when:

- API is deployed.
- API type is not `SOAP`.
- If the API is a standard WSO2 Publisher API, it must have a subscriptionless policy.
- If the API is discovered, key generation must be skipped.

Try it out is disabled with a message when:

| Condition | Message |
| --- | --- |
| API type is `SOAP` | `Try it out is not supported for SOAP APIs` |
| API type is async | `Try it out is not supported for Async APIs` |
| API is discovered and key generation is not skipped | `Try it out is not enabled for discovered APIs` |
| API is not deployed | `API is not deployed to any gateway` |
| Other failure | `Try it out is not available for this API` |

Async detection includes:

- `ASYNC`
- `WS`
- `SSE`
- `WEBHOOK`
- `WEBSUB`

## Warning Panels

### Authentication Required

Shown when:

- Key generation is not skipped.
- Token loading is complete.
- No WSO2 token is available.

Message:

`Sign in with your Asgardeo account to enable 'Try it out' functionality.`

### Gateway Access Failed

Shown when:

- API is not discovered.
- API key generation returns `null`.

Message:

`Failed to generate a temporary access key for the WSO2 Gateway. Please try refreshing the page or checking your connectivity.`

## Loading States

The card shows a centered loading state when:

- Definition loading is true.
- Placeholder detection is true.

Loading text:

- Placeholder: `Syncing with WSO2 Gateway...`
- Normal loading: `Loading API Definition...`

After main loading is complete, a thin progress bar is shown when token or revision loading continues in the background.

## No Definition State

When the definition is `null` and the card is not loading or placeholder-loading, it shows an empty state:

- Title: `No Definition`
- Description: `This API does not have a definition available in the catalog.`

## WSDL Behavior

The WSDL tab appears only when:

- `details.type` is exactly `SOAP`.

The download button calls:

- `apiClient.getApiWsdl(apiId, token)`

The downloaded filename is:

- `{apiId}-wsdl.zip`

The UI text states that the downloaded file may be a single WSDL file or a ZIP archive containing multiple schema files.

## Document Visualization Summary

Documents are read from:

- `wso2.com/api-documents`

The documents card:

- Shows an empty state when there are no documents.
- Automatically previews a single inline or markdown document.
- Shows a single-document layout for one document.
- Shows a table for multiple documents.

## MCP Tool Visualization Summary

MCP tools are read from:

- `wso2.com/mcp-tools`

The card returns `null` when the parsed tools list is empty.

## API Product Resource Visualization Summary

Product resources are read from:

- `wso2.com/product-resources`

The card flattens API resources and operations into a table. Each operation becomes one row.

## Practical Annotation Checklist

For a standard WSO2 API entity, the frontend works best when these annotations exist:

- `wso2.com/api-id`
- `wso2.com/api-name`
- `wso2.com/api-version`
- `wso2.com/api-context`
- `wso2.com/api-provider`
- `wso2.com/api-type`
- `wso2.com/api-lifecycle-status`
- `wso2.com/is-discovered`
- `wso2.com/api-documents`
- `wso2.com/gateway-endpoints`
- `wso2.com/api-raw-json`

For a self-hosted gateway entity, the frontend also uses:

- `wso2-gateway.com/api-id`
- `wso2-gateway.com/api-endpoints`
- `wso2.com/api-discovery-type`

For an API product entity, the frontend also uses:

- `wso2.com/is-api-product`
- `wso2.com/product-resources`

For an MCP entity, the frontend also uses:

- `wso2.com/is-mcp-server`
- `wso2.com/mcp-tools`
