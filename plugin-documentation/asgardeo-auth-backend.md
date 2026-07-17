# Asgardeo Auth Backend Module

Package: `@local/backstage-plugin-auth-backend-module-asgardeo-provider`

Source folder: `plugins/auth-backend-module-asgardeo-provider`

## Purpose

This backend module adds an `asgardeo` OAuth/OIDC auth provider to the Backstage auth backend.

It uses Backstage's standard OIDC authenticator and registers Asgardeo as a named provider so the frontend can start an Asgardeo sign-in flow through Backstage auth.

## Backend Module Registration

The module is registered as:

| Field | Value |
| --- | --- |
| Plugin ID | `auth` |
| Module ID | `asgardeo-provider` |
| Provider ID | `asgardeo` |

During initialization it:

1. Registers a provider with `authProvidersExtensionPoint`.
2. Uses `createOAuthProviderFactory`.
3. Uses Backstage's `oidcAuthenticator`.
4. Exposes the Asgardeo-specific sign-in resolver names listed below.

## Installation

Add the module to the backend setup:

```ts
backend.add(
  import('@local/backstage-plugin-auth-backend-module-asgardeo-provider'),
);
```

In this repository, auth backend modules are typically added from `packages/backend/src/index.ts`.

## Configuration

Configure the provider under `auth.providers.asgardeo.<environment>`.

Example:

```yaml
auth:
  environment: production
  session:
    secret: ${BACKSTAGE_SESSION_SECRET}
  providers:
    asgardeo:
      production:
        clientId: ${ASGARDEO_CLIENT_ID}
        clientSecret: ${ASGARDEO_CLIENT_SECRET}
        metadataUrl: https://api.asgardeo.io/t/${ASGARDEO_ORGANIZATION}/oauth2/token/.well-known/openid-configuration
        additionalScopes: 'openid profile email'
        prompt: login
        signIn:
          resolvers:
            - resolver: emailMatchingUserEntityProfileEmail
```

The environment key should match `auth.environment`.

## Configuration Fields

| Field | Required | Notes |
| --- | --- | --- |
| `clientId` | Yes | OAuth client ID from the Asgardeo application. |
| `clientSecret` | Yes | OAuth client secret from the Asgardeo application. |
| `metadataUrl` | Yes | OIDC discovery metadata URL for the Asgardeo organization. |
| `additionalScopes` | No | Extra scopes requested during sign-in. The root config uses `openid profile email`. |
| `prompt` | No | Optional OAuth prompt value. The root config uses `login`. |
| `signIn.resolvers` | No | Ordered list of resolver entries used to map the Asgardeo identity to a Backstage user. |

## Metadata URL

The Asgardeo metadata URL follows this shape:

```text
https://api.asgardeo.io/t/{organization}/oauth2/token/.well-known/openid-configuration
```

Replace `{organization}` with the Asgardeo organization name.

## Sign-In Resolvers

The module exports two resolver names:

| Resolver | Behavior |
| --- | --- |
| `emailLocalPartMatchingUserEntityName` | Looks up the Backstage user using the local part of the Asgardeo email address as the catalog entity name. |
| `emailMatchingUserEntityProfileEmail` | Looks up the Backstage user using the Asgardeo email address as `spec.profile.email` on the catalog `User` entity. |

The current root `app-config.yaml` uses:

```yaml
signIn:
  resolvers:
    - resolver: emailMatchingUserEntityProfileEmail
```

This pairs well with the Asgardeo catalog backend module because that module maps SCIM user email addresses into `spec.profile.email`.

## Relationship to the Asgardeo Catalog Module

This auth module and the Asgardeo catalog backend module are separate:

| Module | Responsibility |
| --- | --- |
| Asgardeo auth backend module | Lets users sign in to Backstage with Asgardeo. |
| Asgardeo catalog backend module | Syncs Asgardeo users and groups into the Backstage catalog. |

For sign-in to succeed, the selected resolver must find a matching Backstage `User` entity. In this repository, the recommended pairing is:

1. Use the Asgardeo catalog backend module to sync users from SCIM.
2. Configure the auth provider with `emailMatchingUserEntityProfileEmail`.
3. Ensure the Asgardeo user's email matches the Backstage catalog user's `spec.profile.email`.

## Current Source Details

- The provider is OIDC-backed; the module does not implement a custom authenticator.
- The provider ID is `asgardeo`, so the configuration path is `auth.providers.asgardeo`.
- The package exports the backend module as the default export.
- The package also exports `asgardeoSignInResolvers` for resolver access from code.
