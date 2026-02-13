# WSO2 API Manager Integration Endpoints

This document lists the API endpoints used to integrate Backstage with WSO2 API Manager (APIM), as well as additional administrative endpoints (Carbon Management) available for extended functionality.

## Currently Implemented Endpoints

These endpoints are actively used by the `wso2-api-manager` plugin (both frontend and backend).

### Authentication

*   **Endpoint:** `/oauth2/token`
*   **Method:** `POST`
*   **Purpose:** Obtain an access token for API calls.
*   **Parameters:**
    *   `grant_type`: `client_credentials` or `password`
    *   `client_id`: OAuth2 Client ID
    *   `client_secret`: OAuth2 Client Secret
    *   `scope`: e.g., `apim:api_view`, `apim:api_create`

### DevPortal API (Store)

Used for discovering and viewing API details.

*   **Base Path:** `/api/am/devportal/v3` (configurable)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/apis` | List all available APIs. Supports pagination (`limit`, `offset`) and search (`query`). |
| `GET` | `/apis/{apiId}` | Retrieve detailed information about a specific API. |
| `GET` | `/apis/{apiId}/documents` | List documentation associated with an API. |

### Publisher API

Used for creating and managing APIs.

*   **Base Path:** `/api/am/publisher/v4` (configurable)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/apis` | List created APIs (Publisher view). Supports pagination and search. |
| `POST` | `/apis` | Create a new API. Requires `apim:api_create` scope. |

---

## Administrative & Carbon Management Endpoints

These endpoints are part of the WSO2 Carbon platform and APIM Admin API. They are useful for advanced management tasks like user provisioning, tenant management, and system configuration.

### Admin REST API

Used for system-wide administration tasks.

*   **Base Path:** `/api/am/admin/v3`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/policies/throttling/advanced` | List advanced throttling policies. |
| `GET` | `/key-managers` | List registered Key Managers. |
| `GET` | `/tenant-info/{username}` | Get tenant information for a specific user. |
| `POST` | `/workflows/update-workflow-status`| Approve or reject workflow tasks (e.g., subscription approval). |

### SCIM 2.0 (User Management)

Standard REST API for managing users and groups. Recommended over SOAP for user operations.

*   **Base Path:** `/scim2`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/Users` | List users in the user store. |
| `GET` | `/Users/{id}` | Get details of a specific user. |
| `POST` | `/Users` | Create a new user. |
| `GET` | `/Groups` | List groups (roles). |
| `POST` | `/Groups` | Create a new group. |

### Carbon SOAP Admin Services

Legacy SOAP services for deep system management. These require XML payloads and are accessed via the Carbon Servlet.

*   **Base Path:** `/services`
*   **Examples:**

| Service Name | Endpoint | Description |
| :--- | :--- | :--- |
| `RemoteUserStoreManagerService` | `/services/RemoteUserStoreManagerService` | Manage users, roles, and permissions (if SCIM is not sufficient). |
| `TenantMgtAdminService` | `/services/TenantMgtAdminService` | Create and manage tenants. |
| `UserRealm` | `/services/UserRealm` | Access the underlying user realm configuration. |
| `ServerAdmin` | `/services/ServerAdmin` | Server status, restart, and shutdown operations. |

> **Note:** Accessing SOAP services usually requires Basic Auth with admin credentials and specific Carbon permissions.

---

## Connection Reference

When configuring the Backstage integration (e.g., in `app-config.yaml`), use the Base URL of your WSO2 APIM instance (e.g., `https://api.example.com` or `https://localhost:9443`). The specific API paths listed above are appended to this base URL by the plugin.
