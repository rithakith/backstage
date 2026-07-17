# WSO2 API Manager Frontend Plugin

Package: `@local/backstage-plugin-wso2-api-manager`

Source folder: `plugins/wso2-api-manager`

## Purpose

This plugin provides the frontend user interface for WSO2 API Manager inside Backstage.

It contains:

- A routable WSO2 API Manager page at `/wso2-api-manager`.
- Catalog entity cards for WSO2 API entities.
- API definition rendering for OpenAPI, Swagger, GraphQL, WebSocket, SOAP, async, and operations-only definitions.
- Document display and download support.
- API Product resource display.
- MCP tool display.
- WSO2 gateway URL display.
- API key handling for Try it out where supported.

## Plugin Registration

The classic Backstage plugin is defined with plugin ID `wso2-api-manager`.

The routable extension is:

- `Wso2ApiManagerPage`
- Mounted through `rootRouteRef`

The plugin also defines an optional external route:

- `viewTechDocRouteRef`
- Parameters: `namespace`, `kind`, `name`

The alpha frontend plugin exports page and entity card blueprints:

| Blueprint | Name | Filter |
| --- | --- | --- |
| `wso2ApiManagerPage` | Page | Path `/wso2-api-manager` |
| `entityWso2ApiOverviewCard` | `overview` | `kind: component` |
| `entityWso2ApiDefinitionCard` | `definition` | `kind: api` |
| `entityWso2ApiDocumentsCard` | `documents` | `kind: api` |
| `entityWso2AboutCard` | `about` | `kind: api` |
| `entityWso2McpToolsCard` | `mcp-tools` | `kind: api` |
| `entityWso2ApiProductResourcesCard` | `product-resources` | `kind: api` |

## Frontend API Client

The frontend client class is `Wso2ApiManagerClient`.

It uses:

- `discoveryApi.getBaseUrl('wso2-api-manager')` to locate the backend plugin.
- `fetchApi.fetch` for requests.
- `X-WSO2-Access-Token` when a WSO2 user token is available.

Methods currently implemented by the client:

| Method | Backend path |
| --- | --- |
| `generateApiKey(apiId, options)` | `POST /apis/{apiId}/generate-key` |
| `getRevisions(apiId, options)` | `GET /apis/{apiId}/revisions` |
| `getGateways(token)` | `GET /gateways` |
| `getHealth(token)` | `GET /health` |
| `refreshCatalog(token)` | `POST /refresh` |
| `getServices(options)` | `GET /services` |
| `getServiceUsage(serviceId, token)` | `GET /services/{serviceId}/usage` |
| `getServiceDefinition(serviceId, token)` | `GET /services/{serviceId}/definition` |
| `getApiWsdl(apiId, token)` | `GET /apis/{apiId}/wsdl` |

Note: the current backend router source defines most of these paths, but no `/health` route was present in the inspected backend router.

## Main Entity Predicates

The utility file defines these entity checks:

| Function | Logic |
| --- | --- |
| `isWso2Api(entity)` | Returns true when annotation `wso2.com/api-id` exists. |
| `isMcpEntity(entity)` | Returns true when annotation `wso2.com/is-mcp-server` is exactly `true`. |
| `hasMultipleComponentRelations(entity)` | Returns true when more than one relation has a type containing `api` and targets a `component:` ref. |

## Main Catalog Cards

### EntityWso2AboutCard

Shows WSO2-specific entity metadata.

It reads:

- Entity name and title.
- `wso2.com/api-lifecycle-status` or `wso2-gateway.com/api-lifecycle-status`.
- `wso2.com/api-context` or `wso2-gateway.com/api-context`.
- `wso2.com/api-version` or `wso2-gateway.com/api-version`.
- `wso2.com/api-provider` or `wso2-gateway.com/api-provider`.
- `wso2.com/api-endpoints` or `wso2-gateway.com/api-endpoints`.
- Parsed `wso2.com/api-raw-json` for fallback values.
- Entity description or parsed raw JSON description.

It also creates a `View TechDocs` link to the entity route plus `/wso2`.

### EntityWso2ApiOverviewCard

Shows API documents and, for eligible entities, gateway endpoints.

It requires annotation:

- `wso2.com/api-id`

It reads:

- `wso2.com/api-documents`
- `wso2.com/api-raw-json`
- `wso2.com/api-discovery-type`

If `wso2.com/api-id` is missing, it renders an empty state asking for the annotation.

If `wso2.com/api-raw-json` cannot be parsed or does not exist, it renders an empty state saying API metadata could not be found.

It displays `EntityWso2ApiDocumentsCard` in all valid cases.

It displays a `Gateway Endpoints` table only when:

- Parsed raw JSON has an `endpointURLs` property.
- `endpointURLs` is non-empty.
- `wso2.com/api-discovery-type` is not `api-platform-gateway`.

### EntityWso2ApiDefinitionCard

This is the main definition and console card. It is documented in detail in [Frontend Entity Visualization Rules](./frontend-entity-visualization.md).

At a high level, it:

- Reads the WSO2 API ID from `wso2.com/api-id` or `wso2-gateway.com/api-id`.
- Reads WSO2 metadata from `wso2.com/api-raw-json`.
- Reads the API definition from `entity.spec.definition`.
- Builds the tab model according to API type, discovery type, operation shape, deployment state, and available policies.
- Uses the backend plugin for deployed revision checks and WSDL downloads.

If no API ID is found, the card returns `null`.

### EntityWso2ApiDocumentsCard

Displays WSO2 documents.

Documents may be passed as props or read through the document hook from entity annotations.

Behavior:

- Shows progress when `loading` prop is true.
- Shows an error panel when `error` prop is present.
- Shows an empty state when no documents exist.
- Automatically previews a single `MARKDOWN` or `INLINE` document.
- For one document, renders a single-document view.
- For multiple documents, renders a table and opens previews when selected.

### EntityWso2McpToolsCard

Displays MCP tools from annotation:

- `wso2.com/mcp-tools`

If the annotation is missing, invalid, or parses to an empty list, the card returns `null`.

When tools exist, it displays a searchable, paged table with:

- Tool name
- Description

### EntityWso2ApiProductResourcesCard

Displays API Product resource operations from annotation:

- `wso2.com/product-resources`

The annotation is parsed as an array of product resources. Each resource is flattened into rows by operation.

Columns:

- API name
- Version
- Path
- Method

The API name links to `/catalog/{namespace}/api/{normalized-api-name}`.

HTTP method colors:

| Method | Color |
| --- | --- |
| `GET` | `#61affe` |
| `POST` | `#49cc90` |
| `PUT` | `#fca130` |
| `DELETE` | `#f93e3e` |
| `PATCH` | `#50e3c2` |
| Other | `#999` |

## Required Backend Support

The frontend expects the WSO2 API Manager backend plugin to be registered in the backend with plugin ID `wso2-api-manager`.

Without the backend plugin:

- Runtime API key generation will not work.
- Deployed revision checks will not work.
- Gateway listing will not work.
- Service Catalog calls will not work.
- WSDL downloads will not work.
- Document content downloads through the backend proxy will not work.

## Required Catalog Data

For the WSO2 catalog cards to be useful, entities must contain WSO2 annotations. The WSO2 APIM catalog backend module creates these annotations during catalog ingestion.

Manually created entities can also use the frontend if they include the same annotations and a suitable `spec.definition`.
