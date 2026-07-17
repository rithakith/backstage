# Using the Plugin

This page describes the normal user workflows in Backstage.

## Open the WSO2 API Manager Page

Open the WSO2 API Manager page from the Backstage navigation.

The registered path is:

```text
/wso2-api-manager
```

Depending on the app configuration, the sidebar label may differ.

Use this page to view WSO2 APIs, API products, MCP servers, services, and gateways in one place.

## Find a WSO2 API in the Catalog

1. Open the Backstage catalog.
2. Filter or search for the API name.
3. Open the API entity.
4. Review the WSO2-specific cards on the entity page.

If the API does not appear, wait for the next catalog sync or ask a Backstage admin to check the WSO2 catalog provider logs.

## View API Metadata

The WSO2 cards can show:

- Lifecycle status.
- API context.
- Version.
- Provider.
- Description.
- Gateway endpoints.
- Business and technical owners where available.

Some fields depend on metadata returned by WSO2 during catalog ingestion. Missing fields usually mean the source data was not present or not mapped.

## View an API Definition

Open the API entity and use the definition card.

Supported definition styles include:

- OpenAPI.
- Swagger.
- GraphQL.
- WebSocket.
- SOAP.
- Async-style APIs.
- Operations-only definitions.

The exact tabs and console options depend on the API type, definition content, discovery type, deployment state, and available policy data.

For a visual explanation of how the plugin decides what to show, see [Visual Decision Guide](./08-visual-decision-guide.md).

## View API Documents

Open the API entity and use the documents card.

The card can:

- Show an empty state when no documents exist.
- Preview a single inline or markdown document.
- Show a table when multiple documents exist.
- Download document content through the backend plugin.

If document download fails, check whether the backend plugin is registered and whether the WSO2 document still exists.

## Download WSDL

For APIs with WSDL support, use the WSDL download action from the API definition card.

The backend streams WSDL content from WSO2 and preserves the upstream content type and disposition where available.

If the WSDL download fails, the API may not expose WSDL content, the WSO2 token may not have permission, or the backend route may be unable to reach WSO2.

## Generate an API Key

When available, use the API key generation section in the API definition card.

Current behavior to know:

- The action requires a Backstage-authenticated user.
- The inspected backend implementation uses the WSO2 service-account path for API key generation.
- API platform and self-hosted gateway entities may skip key generation depending on discovery type.

If key generation is not visible or fails, check the API type, discovery type, deployment state, WSO2 scopes, and backend logs.

## View Gateway Information

Use the WSO2 API Manager page to view gateway information.

Gateway data can come from:

- WSO2 API Manager Publisher settings.
- `wso2PlatformGateway` configuration.
- Gateway discovery URLs, when configured.

Gateway status for self-hosted gateways depends on whether discovery succeeds.

## View Services

Use the WSO2 API Manager page to view WSO2 Service Catalog services.

For a service, the UI can load:

- Usage data.
- Service definition text.

These features require the Service Catalog base path and WSO2 permissions to be configured.

## View API Products

API products appear as Backstage `API` entities.

The API product resources card can show:

- API name.
- Version.
- Path.
- HTTP method.

Each listed API name can link to its Backstage catalog API entity when the normalized entity name matches.

## View MCP Tools

MCP server entities can show an MCP tools card.

The card appears only when the entity contains `wso2.com/mcp-tools` data and that data parses into a non-empty tool list.

## Use Asgardeo Sign-In

If Asgardeo auth is configured, sign in through the Asgardeo provider in the Backstage sign-in page.

If sign-in succeeds but Backstage cannot resolve the user, confirm that the matching Backstage `User` entity exists and that the configured sign-in resolver matches the catalog user data.
