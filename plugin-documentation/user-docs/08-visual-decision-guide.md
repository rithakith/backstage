# Visual Decision Guide

This page explains how the WSO2 UI decides what a user sees for an API entity.

The goal is to describe the behavior without requiring users to understand source code, backend routes, hooks, or catalog internals.

## Recommended Visualization

Use both:

- A decision tree for conditional behavior.
- A feature matrix for quick comparison.

The decision tree is best when explaining why a tab, console, or API key section appears or does not appear. The matrix is best when users want to quickly compare HTTP, SOAP, GraphQL, WebSocket, discovered APIs, API products, MCP servers, and services.

## API Definition Decision Tree

```mermaid
flowchart TD
  A["User opens a WSO2 API entity"] --> B{"Does the entity have a WSO2 API id?"}
  B -->|No| B1["Do not show the WSO2 definition card"]
  B -->|Yes| C{"Is a definition available in the catalog?"}

  C -->|No| C1["Show 'No Definition' empty state"]
  C -->|Still syncing or placeholder| C2["Show syncing/loading state"]
  C -->|Yes| D{"What kind of entity is it?"}

  D -->|Standard WSO2 Publisher API| E["Check deployed revisions"]
  D -->|API platform entity| F["Use platform gateway endpoints"]
  D -->|Self-hosted gateway entity| G["Use self-hosted gateway endpoints"]
  D -->|Gateway-discovered API| H["Use discovered gateway metadata"]

  E --> E1{"Has deployed revision?"}
  E1 -->|Yes| E2["Treat as deployed"]
  E1 -->|No| E3["Treat as not deployed"]

  F --> F1{"Has gateway endpoint?"}
  F1 -->|Yes| F2["Treat as deployed"]
  F1 -->|No| F3["Treat as not deployed"]

  G --> G1{"Has gateway endpoint?"}
  G1 -->|Yes| G2["Treat as deployed"]
  G1 -->|No| G3["Treat as not deployed"]

  H --> H1["Invocation is usually disabled for discovered APIs"]

  E2 --> I{"What API type is it?"}
  E3 --> I
  F2 --> I
  F3 --> I
  G2 --> I
  G3 --> I
  H1 --> I

  I -->|HTTP or REST| J["Show Swagger UI when definition is OpenAPI or Swagger"]
  I -->|Operations-only| K["Show Operations tab"]
  I -->|GraphQL| L["Show GraphQL Console"]
  I -->|WebSocket| M["Show WebSocket Console"]
  I -->|SOAP| N["Show WSDL tab and WSDL download"]
  I -->|Async type| O["Show source or policy view; Try it out is disabled"]
  I -->|MCP server| P["Show MCP tools where available"]
  I -->|API product| Q["Show product resources where available"]

  J --> R{"Can Try it out be enabled?"}
  K --> R
  L --> R
  M --> R
  N --> R
  O --> R

  R -->|SOAP| R1["Try it out disabled: SOAP APIs are not supported"]
  R -->|Async| R2["Try it out disabled: Async APIs are not supported"]
  R -->|Not deployed| R3["Try it out disabled: API is not deployed to a gateway"]
  R -->|Discovered API without supported gateway mode| R4["Try it out disabled: discovered API invocation is not enabled"]
  R -->|Supported and deployed| S["Show available console or Try it out experience"]
```

## API Key and Invocation Decision Tree

```mermaid
flowchart TD
  A["User views a definition or console"] --> B{"Is this an API platform or self-hosted gateway entity?"}
  B -->|Yes| B1["Skip automatic API key generation"]
  B -->|No| C{"Is the API discovered?"}

  C -->|Yes| C1["Do not show gateway access error panel"]
  C -->|No| D{"Is the API deployed?"}

  D -->|No| D1["Try it out is disabled because no deployed gateway is available"]
  D -->|Yes| E{"Is the API SOAP or Async?"}

  E -->|SOAP| E1["Show WSDL download; Try it out is disabled"]
  E -->|Async| E2["Show async/source information; Try it out is disabled"]
  E -->|No| F{"Does the API support subscriptionless access?"}

  F -->|No| F1["Automatic key section is hidden; Try it out may be disabled for standard WSO2 APIs"]
  F -->|Yes| G{"Does the API expose an API key header?"}

  G -->|No| G1["Automatic key section is hidden because no API key header is available"]
  G -->|Yes| H{"Can the user get a WSO2 access token?"}

  H -->|No| H1["Show authentication required warning"]
  H -->|Yes| I["User can request or refresh an API key"]

  I --> J{"Key generation succeeds?"}
  J -->|Yes| J1["Store the generated key and use it in the console"]
  J -->|No| J2["Show gateway access failed warning for non-discovered APIs"]

  J2 --> K["User can retry or manually provide an API key where the UI allows it"]
  F1 --> K
  G1 --> K
  B1 --> K
```

## Tab Selection Summary

| Condition | User-facing result |
| --- | --- |
| Missing WSO2 API id | WSO2 definition card does not render. |
| Definition is missing | Empty state says no definition is available. |
| Definition is still syncing or placeholder | Loading state says it is syncing with WSO2 Gateway. |
| API type is `GRAPHQL` | GraphQL Console tab is selected. |
| API type is `WS` | WebSocket Console tab is selected. |
| API type is `SOAP` | WSDL tab is available. |
| Definition has operations but no OpenAPI or Swagger document | Operations tab is shown. |
| Definition is OpenAPI or Swagger | Swagger UI is shown. |
| Policies or operations are available | Policies tab is shown. |
| Source view is available | View Source tab is shown. |

## Feature Availability Matrix

| API or entity type | Main view | Invocation behavior | API key behavior | Download behavior |
| --- | --- | --- | --- | --- |
| HTTP or REST API | Swagger UI | Enabled only when deployed and supported by policy/header conditions | Automatic key section can appear for deployed, non-discovered, subscriptionless APIs with API key header support | Documents if available |
| GraphQL API | GraphQL Console | Can use gateway URLs when deployed | Same key conditions as supported standard APIs | Documents if available |
| WebSocket API | WebSocket Console | Can use gateway URLs when deployed | Same key conditions as supported standard APIs | Documents if available |
| SOAP API | WSDL tab | Try it out disabled | Automatic key flow is not the main path | WSDL download and documents if available |
| Async API | Source or policy-oriented view | Try it out disabled | Automatic key flow is not the main path | Documents if available |
| Operations-only API | Operations tab | Console can be built from operations when available | Same key conditions as supported standard APIs | Documents if available |
| API platform entity | Definition and gateway endpoints | Deployment is inferred from gateway endpoints | Automatic key generation is skipped | Documents if available |
| Self-hosted gateway entity | Definition and gateway endpoints | Deployment is inferred from gateway endpoints | Automatic key generation is skipped | Documents if available |
| Gateway-discovered API | Discovered metadata and definition if present | Invocation is usually disabled | Gateway access error panel is hidden | Documents if available |
| API product | Product resources | No direct product-level invocation documented for users | Not applicable in current user flow | Not applicable |
| MCP server | MCP tools | No standard API invocation flow | Not applicable in current user flow | Documents if available |
| Service Catalog service | Service details, usage, and definition | No API console flow | Not applicable | Service definition download |

## User-Friendly Wording

When documenting this behavior for users, prefer:

- "If the API is deployed..."
- "If WSO2 provides an OpenAPI definition..."
- "If the API supports API-key access..."
- "If the API was discovered from a gateway..."
- "If invocation is not supported for this API type..."

Avoid source-level terms such as component names, hook names, backend route names, and internal variable names in user-facing docs.
