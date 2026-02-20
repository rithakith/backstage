# Design Outline: Backstage Plugin for WSO2 API Manager

## 1. What is the problem we are trying to solve?

Organizations using Backstage as their internal developer portal cannot integrate it with WSO2 API Manager. Developers have to switch between Backstage (for service catalogs, documentation, and developer tools) and the API Manager Publisher/Developer portals (for API management tasks). This split workflow makes API development harder - developers cannot discover APIs, manage subscriptions, publish new APIs, or view API analytics from one place. Organizations also cannot use API Manager's features (API lifecycle management, monetization, analytics, security) within their existing Backstage setup.

## 2. Who are we solving the problem for?

**Primary Users:**
- **API Developers**: Need to publish, version, and manage APIs from within their familiar Backstage environment
- **API Consumers**: Need to discover, subscribe to, and consume APIs without leaving Backstage
- **Platform Teams**: Want to provide a unified developer experience while using API Manager as the API gateway/management layer

**Organizations:** Enterprises already using Backstage who want to adopt WSO2 API Manager, or existing API Manager users who want to migrate their developer portal experience to Backstage.

## 3. Why should it be solved?

Backstage has become a widely adopted standard for internal developer portals (used by Spotify, Netflix, American Airlines, and 1000+ organizations). Many WSO2 API Manager users want a unified developer experience. Without this plugin:
- Organizations cannot use their Backstage setup when using API Manager
- Developers waste time switching between tools, reducing productivity
- Platform teams must maintain separate portals instead of one unified portal
- WSO2 misses opportunities with organizations using Backstage

This integration allows WSO2 to compete in the Backstage ecosystem (where competitors like Kong and Apigee already have integrations) and provides immediate value to organizations using both platforms.

## 4. Solution

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Backstage Frontend                       │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │  API Catalog   │  │ API Details  │  │ API Analytics  │ │
│  │   Component    │  │  Component   │  │   Component    │ │
│  └────────┬───────┘  └──────┬───────┘  └────────┬───────┘ │
│           │                  │                    │         │
│           └──────────────────┴────────────────────┘         │
│                              │                              │
│                    @backstage/plugin-api-manager            │
└──────────────────────────────┼──────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Backstage Backend  │
                    │  ┌───────────────┐  │
                    │  │  API Manager  │  │
                    │  │    Backend    │  │
                    │  │    Plugin     │  │
                    │  └───────┬───────┘  │
                    └──────────┼──────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
        ┌───────▼──────┐ ┌────▼─────┐ ┌─────▼──────┐
        │ Publisher    │ │Developer │ │  Admin     │
        │ REST API     │ │ REST API │ │  REST API  │
        └───────┬──────┘ └────┬─────┘ └─────┬──────┘
                │              │              │
                └──────────────┼──────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  WSO2 API Manager   │
                    │  (4.x, 5.x)         │
                    └─────────────────────┘
```

### Core Features

**1. API Discovery & Catalog Integration**
- Sync APIs from API Manager into Backstage Software Catalog as `API` entities
- Search and filter APIs by provider, version, lifecycle state, tags
- Display API specifications (OpenAPI/GraphQL) inline

**2. API Subscription Management**
- Browse available APIs and subscription tiers
- Create/manage applications in API Manager from Backstage
- Subscribe to APIs, generate/regenerate API keys and tokens
- View subscription analytics and quota usage

**3. API Publishing Workflow**
- Create new APIs via Backstage scaffolder templates
- Publish OpenAPI specs to API Manager
- Manage API lifecycle (CREATE → PUBLISH → DEPRECATE)
- Configure security policies, rate limits, and monetization

**4. Analytics & Monitoring**
- Embed API usage analytics from API Manager
- Show subscriber statistics, error rates, latency metrics
- Alert integration for API health issues

### API Specification

Backend plugin will expose:
```
GET /api/apim/apis - List APIs (paginated, filterable)
GET /api/apim/apis/{id} - Get API details
POST /api/apim/apis - Create API
PUT /api/apim/apis/{id} - Update API
POST /api/apim/apis/{id}/publish - Publish API
GET /api/apim/applications - List applications
POST /api/apim/applications - Create application
POST /api/apim/subscriptions - Subscribe to API
GET /api/apim/analytics/{apiId} - Get API analytics
```

Full OpenAPI spec: [Link to be added in detailed design]

### Data Persistence

**Backstage Catalog Database:**
- Store API entities synced from API Manager (cached for performance)
- Fields: `apiId`, `name`, `version`, `provider`, `context`, `status`, `spec`, `lastSyncedAt`

**No Additional Database:** Plugin mainly works as a connection to API Manager REST APIs. Catalog sync allows browsing and searching when offline.

### Authentication Flow

1. Configure OAuth2 app in API Manager for Backstage
2. Backend plugin authenticates using OAuth2 Client Credentials flow
3. User identity from Backstage auth is mapped to API Manager users/tenants
4. Plugin passes user context in API Manager API calls

### Configuration Example
```yaml
apim:
  host: https://apim.company.com
  publisher:
    clientId: ${APIM_CLIENT_ID}
    clientSecret: ${APIM_CLIENT_SECRET}
  developer:
    clientId: ${APIM_DEV_CLIENT_ID}
    clientSecret: ${APIM_DEV_CLIENT_SECRET}
  syncInterval: 300 # seconds
```

### Alternatives Considered

**1. Embed API Manager UIs via iframes:** Rejected - poor user experience, no native Backstage integration, breaks navigation
**2. Custom API Gateway Proxy:** Rejected - beyond scope, would duplicate API Manager functionality
**3. Serverless Functions as Middleware:** Rejected - adds complexity, creates vendor lock-in

## 5. Challenges & Constraints

**Security Considerations:**
- **OAuth2 Token Management:** Store client credentials securely, refresh tokens before they expire, use Backstage's backend token proxy pattern
- **User Authorization:** Connect Backstage users to API Manager roles/tenants using identity federation (OIDC)
- **API Key Exposure:** Never show keys in the frontend, handle all key operations through the backend
- **Tenant Isolation:** In multi-tenant API Manager setups, make sure users can only access their tenant's APIs

**API Manager Version Compatibility:**
- Support API Manager 4.x and 5.x (they have different REST API formats)
- Use feature detection to turn features on/off based on version
- Document the minimum supported versions

**Performance & Scalability:**
- **Catalog Sync:** Background job syncs APIs every 5 minutes (can be changed), use pagination for large numbers of APIs
- **Rate Limiting:** Follow API Manager rate limits, use client-side caching (5-minute cache time)
- **Analytics Queries:** Load analytics only when requested, cache summary data

**Multi-Tenancy:**
- Support API Manager's multi-tenant setup
- Connect Backstage organizations to API Manager tenants
- Set tenant domain in plugin config or detect it from user identity

**Backward Compatibility:**
- Plugin follows Backstage's standard plugin structure (separate frontend and backend)
- Uses stable Backstage APIs (@backstage/core-plugin-api, @backstage/backend-plugin-api)
- Does not require any changes to API Manager configuration

**Monitoring:**
- Track metrics for sync job success/failures (using Backstage's built-in monitoring)
- Log API Manager API errors for debugging
- Health check endpoint: `/api/apim/health`

**Limitations:**
- Does not replace API Manager portals for admin tasks (tenant management, advanced policy setup)
- Requires API Manager 4.0+ (needs REST API support)
- Analytics are read-only (cannot create custom dashboards in Backstage)

---

**Estimated Implementation Effort:** 6 months (1 developer)  
**Target API Manager Versions:** 4.x, 5.x  
**Backstage Compatibility:** v1.20+  
**Delivery:** Open-source plugin published to npm, documentation, sample app
