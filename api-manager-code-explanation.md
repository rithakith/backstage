# WSO2 API Manager Plugin Code Explanation

This document provides a detailed explanation of the code components used in the WSO2 API Manager Backstage plugins, complementing the overview in `api-manager-plugins-readme.md`.

## Frontend Plugin Code (`plugins/wso2-api-manager`)

### 1. Plugin Registration (`src/plugin.ts`)
**File:** `plugins/wso2-api-manager/src/plugin.ts`

This file is the entry point for the frontend plugin.

-   **`createPlugin`**: Registers the plugin with the ID `wso2-api-manager`.
-   **Routes**: Defines two main routes:
    -   `root`: For the API Manager page ([/api-manager]).
    -   `publisher`: For the Publisher page ([/api-manager/publisher]).
-   **Extensions**: Exports routable extensions (`Wso2ApiManagerPage` and `Wso2PublisherPage`) using `createRoutableExtension`. This allows these pages to be dynamically loaded and mounted in the main Backstage application.
    -   They use dynamic `import()` to lazy-load the actual component code, improving initial load performance.

### 2. Frontend API Client (`src/api/Wso2ApiManagerClient.ts`)
**File:** `plugins/wso2-api-manager/src/api/Wso2ApiManagerClient.ts`

This class acts as the bridge between the frontend UI and the Backstage backend plugin.

-   **Constructor**: Receives `DiscoveryApi` (to find the backend URL) and `FetchApi` (to make authenticated HTTP requests).
-   **`getBaseUrl()`**: Asynchronously retrieves the base URL for the `wso2-api-manager` backend plugin.
-   **Methods**:
    -   `listApis`, `getApi`, `listDocuments`: Fetch data from the WSO2 Devportal via the backend.
    -   `listPublisherApis`, `createPublisherApi`: Interact with the WSO2 Publisher API via the backend.
-   **Error Handling**: Checks `response.ok` and throws errors if requests fail this ensures UI components can catch and display errors.

## Backend Plugin Code (`plugins/wso2-api-manager-backend`)

### 1. Router (`src/service/router.ts`)
**File:** `plugins/wso2-api-manager-backend/src/service/router.ts`

This file sets up the Express router used by the backend plugin.

-   **`createRouter`**: The main function that initializes the router.
-   **Authentication**: Uses `HttpAuthService` to ensure requests are authenticated.
    -   `await httpAuth.credentials(req, { allow: ['user'] });` is called in every route handler to restrict access to authenticated Backstage users.
-   **Config & Client**: Reads configuration using `readWso2ApiManagerConfig` and initializes the `Wso2ApiManagerClient`.
-   **Endpoints**: Maps incoming HTTP requests to methods on the `Wso2ApiManagerClient`.
    -   Input validation helper functions (`readNumber`, `readString`, `readCreatePublisherApiRequest`) are used to validate query parameters and request bodies before passing them to the business logic.

### 2. WSO2 Client Service (`src/service/wso2Client.ts`)
**File:** `plugins/wso2-api-manager-backend/src/service/wso2Client.ts`

This is the core business logic file responsible for communicating with the external WSO2 API Manager instance.

#### Configuration Parsing (`readWso2ApiManagerConfig`)
-   Reads settings from `app-config.yaml` under the `wso2ApiManager` key.
-   Handles defaults for paths (e.g., `/api/am/devportal/v3`).
-   Constructs the auth configuration, including support for both `client_credentials` and `password` grant types.

#### Wso2ApiManagerClient Class
-   **Token Management (`getAccessToken`)**:
    -   Implements an OAuth2 client.
    -   Caches the access token in memory (`this.accessToken`).
    -   Checks expiration (`this.tokenExpiresAt`) and proactively refreshes the token 60 seconds before it expires to prevent failures.
    -   Uses `undici` for HTTP requests, configured with a custom `Dispatcher` if `rejectUnauthorized` is false (for self-signed certs).
-   **API Interaction**:
    -   `request<T>` and `requestPublisher<T>`: Helper methods that wrap `undiciFetch`. They automatically inject the `Authorization: Bearer ...` header using the valid access token.
    -   `buildPublisherCreatePayload`: transforming a simple input object into the complex JSON payload required by WSO2's Publisher API (setting `endpointConfig` JSON string, `visibility`, etc.).
-   **Data Mapping**:
    -   Helper functions (`mapApiSummary`, `mapApiDetail`, `mapApiDocument`) transform the raw WSO2 JSON response into clean TypeScript objects used by the frontend. This decouples the frontend from specific WSO2 API field names.

## Summary of Data Flow

1.  **Frontend Component** calls `Wso2ApiManagerClient` (Frontend).
2.  **Frontend Client** calls **Backend Router** (`/api/wso2-api-manager/...`).
3.  **Backend Router** validates the Backstage user's identity.
4.  **Backend Router** calls **Backend Client** (`Wso2ApiManagerClient`).
5.  **Backend Client** checks for a valid cached WSO2 OAuth token.
    -   If missing or expired, it requests a new one from WSO2 Token Endpoint.
6.  **Backend Client** calls WSO2 REST API (Devportal or Publisher) using the token.
7.  **Backend Client** maps the response and returns it up the chain.
