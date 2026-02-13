# External Access to WSO2 API Manager Devportal

This guide explains how to access WSO2 API Manager endpoints externally (outside of the Backstage plugin), specifically for retrieving APIs from the Devportal. This mimics the logic used internally by the Backstage backend plugin.

## Prerequisites

To access the WSO2 API Manager APIs, you need an **OAuth2 Application** registered in WSO2.

1.  **Log in** to the WSO2 Devportal (e.g., `https://localhost:9443/devportal`).
2.  **Create an Application** (or use the Default Application).
3.  **Generate Keys**:
    -   Go to the **Production Keys** tab.
    -   Click **Generate Keys**.
    -   Note down the **Consumer Key** (Client ID) and **Consumer Secret** (Client Secret).
    -   Ensure the token has the `apim:api_view` scope (or `apim:admin` / `apim:api_create` depending on your needs, but `apim:api_view` is sufficient for listing APIs).

## Workflow

The access pattern follows standard OAuth 2.0 Client Credentials or Password Grant flows.

### 1. Obtain an Access Token

You must first exchange your credentials for a Bearer token.

**Endpoint:** `https://<WSO2_HOST>:<PORT>/oauth2/token`
**Method:** `POST`
**Headers:**
-   `Authorization`: `Basic <Base64(ConsumerKey:ConsumerSecret)>`
    -   *Note: You can also pass `client_id` and `client_secret` in the body if Basic Auth is not used, but Basic Auth is the standard WSO2 method.*
-   `Content-Type`: `application/x-www-form-urlencoded`

**Body (Client Credentials - Recommended for Services):**
```bash
grant_type=client_credentials
scope=apim:api_view
```

**Body (Password Grant - If acting as a specific user):**
```bash
grant_type=password
username=<your_username>
password=<your_password>
scope=apim:api_view
```

#### Example cURL
```bash
# Replace with your actual base64 encoded ConsumerKey:ConsumerSecret
# Base64 string = base64("MY_KEY:MY_SECRET")

curl -k -X POST https://localhost:9443/oauth2/token \
  -H "Authorization: Basic N2R...5aQ==" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "scope=apim:api_view"
```

**Response:**
```json
{
    "access_token": "e95...",
    "scope": "apim:api_view",
    "token_type": "Bearer",
    "expires_in": 3600
}
```

### 2. Call the Devportal API

Once you have the `access_token`, you can call the Devportal APIs. The Devportal API allows you to search and list APIs visible to your application.

**Endpoint:** `https://<WSO2_HOST>:<PORT>/api/am/devportal/v3/apis`
**Method:** `GET`
**Headers:**
-   `Authorization`: `Bearer <access_token>`
-   `Content-Type`: `application/json`

#### Example cURL
```bash
curl -k -X GET https://localhost:9443/api/am/devportal/v3/apis \
  -H "Authorization: Bearer e95..." \
  -H "Content-Type: application/json"
```

**Response (Simplified):**
```json
{
    "count": 1,
    "list": [
        {
            "id": "12345-6789...",
            "name": "PizzaShackAPI",
            "version": "1.0.0",
            "context": "/pizzashack/1.0.0",
            "provider": "admin",
            "lifeCycleStatus": "PUBLISHED"
        }
    ],
    "pagination": { ... }
}
```

## How the Backstage Plugin Does It

The logic described above is implemented programmatically in the `Wso2ApiManagerClient` class within the backend plugin (`plugins/wso2-api-manager-backend/src/service/wso2Client.ts`).

### 1. Reading Configuration
The plugin reads the `clientId`, `clientSecret`, and other auth details from `app-config.yaml`.

```typescript
// plugins/wso2-api-manager-backend/src/service/wso2Client.ts

export function readWso2ApiManagerConfig(
  config: RootConfigService,
): Wso2ApiManagerConfig {
  // ...
  const authConfig = wso2Config.getConfig('auth');
  // ...
  return {
    // ...
    auth: {
      tokenUrl,
      // ...
      clientId: authConfig.getString('clientId'),
      clientSecret: authConfig.getString('clientSecret'),
    },
  };
}
```

### 2. Fetching the Access Token
The `getAccessToken` method handles the OAuth flow, including base64 encoding credentials and caching the token.

```typescript
// plugins/wso2-api-manager-backend/src/service/wso2Client.ts

private async getAccessToken(): Promise<string> {
  // Check if cached token is still valid
  if (this.accessToken && this.tokenExpiresAt) {
    if (Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }
  }

  // Base64 encode ClientID:ClientSecret for Basic Auth
  const encoded = Buffer.from(
    `${this.config.auth.clientId}:${this.config.auth.clientSecret}`,
    'utf8',
  ).toString('base64');

  const form = new URLSearchParams();
  form.set('grant_type', this.config.auth.grantType);
  // ... sets username/password if using password grant ...
  if (this.config.auth.scopes?.length) {
    form.set('scope', this.config.auth.scopes.join(' '));
  }

  // Request new token
  const response = await undiciFetch(this.config.auth.tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
    dispatcher: this.dispatcher,
  });

  // ... error handling ...

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  // Cache token
  const expiresInMs = (data.expires_in ?? 3600) * 1000;
  this.accessToken = data.access_token;
  this.tokenExpiresAt = Date.now() + Math.max(expiresInMs - 60000, 0);

  return this.accessToken;
}
```

### 3. Calling the API
The `request` method retrieves the valid token and attaches it as a Bearer header to the API request.

```typescript
// plugins/wso2-api-manager-backend/src/service/wso2Client.ts

private async request<T>(path: string): Promise<T> {
  const token = await this.getAccessToken();
  const response = await undiciFetch(`${this.devportalBaseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    dispatcher: this.dispatcher,
  });

  // ... error handling ...

  return (await response.json()) as T;
}
```

This implementation abstracts the complexity of token management (generation, caching, refresh) from the rest of the application. The Backstage frontend simply calls the internal backend, which handles the secure communication with WSO2.
