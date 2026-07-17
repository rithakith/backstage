# Authentication and Authorization

This page covers the auth behavior implemented in the inspected source. It does not define the desired security policy for production; review production policy with the platform/security owner.

## Backstage User Authentication

The WSO2 API Manager backend router requires Backstage user credentials for every route in the inspected router.

Each route calls:

```text
httpAuth.credentials(req, { allow: ['user'] })
```

If this check fails, the route returns an error through the route's catch block.

## WSO2 User Token Header

The frontend can send a WSO2 access token through:

```text
X-WSO2-Access-Token
```

The backend intentionally does not use the normal Backstage `Authorization` header as a WSO2 token.

Reason: the Backstage authorization token is a Backstage identity token. WSO2 endpoints expect a WSO2 access token.

## Service Account Authentication

Both the runtime backend plugin and the catalog backend module use client credentials to obtain WSO2 service-account tokens.

The runtime backend plugin reads:

- `wso2ApiManager.auth.clientId`
- `wso2ApiManager.auth.clientSecret`
- `wso2ApiManager.auth.tokenUrl`

The catalog backend module reads the same fields, but defaults `tokenUrl` to:

```text
{wso2ApiManager.baseUrl}/oauth2/token
```

## Token Caching

The runtime backend client caches service-account tokens until five minutes before expiry.

The catalog module client caches service-account tokens until one minute before expiry.

## User Token Fallback

When a WSO2 user token is supplied for selected operations, the backend may retry with a service-account token if WSO2 returns `401`.

This is implemented for:

- Publisher requests.
- Service Catalog requests.
- DevPortal request helper.
- Service definition requests.

Security implication: a user whose WSO2 token fails may still receive data if the service account has access and the route allows fallback.

Review note: decide whether fallback to service account is desired for all routes, or whether some routes should fail when the user token is invalid or unauthorized.

## API Key Generation

`POST /apis/:apiId/generate-key` requires a Backstage-authenticated user.

The inspected route obtains the token returned by `ensureAuthenticated`, but does not pass it to `client.generateApiKey`.

Current source behavior: API key generation uses the service-account path.

If the intended behavior is user-scoped API key generation, update the backend client and route to pass and use the WSO2 user token.

## Asgardeo Auth Provider

The Asgardeo auth backend module registers:

```text
providerId: asgardeo
```

It uses Backstage's OIDC authenticator and exposes these sign-in resolver factories:

- `emailLocalPartMatchingUserEntityName`
- `emailMatchingUserEntityProfileEmail`

The module does not implement custom resolver logic. It delegates to Backstage common sign-in resolvers.

## Asgardeo Catalog Identity

The Asgardeo catalog module syncs groups before users. It builds a group id to Backstage group entity name map, then uses that map while creating user entities.

This pairing matters when auth resolver behavior depends on users and groups being present in the Backstage catalog.

## Permissions

The inspected WSO2 frontend package depends on Backstage permission packages, but the inspected backend routes do not show route-level permission checks beyond Backstage user authentication.

Review note: if operations such as API key generation, catalog refresh, or service definition download require role-based control, add explicit permission checks and document them here.
