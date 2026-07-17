# Asgardeo Catalog Backend Module

Package: `@<packagename>/backstage-plugin-catalog-backend-module-asgardeo`

Source folder: `plugins/catalog-backend-module-asgardeo`

## Purpose

This catalog backend module syncs users and groups from Asgardeo into the Backstage catalog.

It uses the Asgardeo SCIM 2.0 API and maps:

- SCIM users to Backstage `User` entities.
- SCIM groups to Backstage `Group` entities.

This module is not required for WSO2 API ingestion. It is useful when Backstage should also reflect Asgardeo-managed identity data.

## Backend Module Registration

The module is registered as:

| Field | Value |
| --- | --- |
| Plugin ID | `catalog` |
| Module ID | `asgardeo-entity-provider` |

During initialization it:

1. Creates `AsgardeoEntityProvider` with ID `asgardeo`.
2. Adds the provider to `catalogProcessingExtensionPoint`.
3. Reads an optional schedule from `catalog.providers.asgardeo.schedule`.
4. Uses a default schedule when no schedule is configured.
5. Runs the provider on that schedule.

## Default Schedule

When `catalog.providers.asgardeo.schedule` is not configured, the module uses:

```yaml
frequency: { minutes: 30 }
timeout: { minutes: 5 }
initialDelay: { seconds: 5 }
```

## Provider Name

The provider name is:

```text
asgardeo
```

The provider uses this as the catalog mutation `locationKey`.

## Organization Resolution

The provider reads the Asgardeo organization from:

```yaml
catalog:
  providers:
    asgardeo:
      organization: ...
```

This value is required.

## Credential Resolution

The `AsgardeoClient` reads OAuth client credentials from:

```yaml
catalog:
  providers:
    asgardeo:
      clientId: ...
      clientSecret: ...
```

Both values are required.

## Token Request

The client requests an Asgardeo access token from:

```text
https://api.asgardeo.io/t/{organization}/oauth2/token
```

Request details:

| Field | Value |
| --- | --- |
| Method | `POST` |
| Auth | HTTP Basic using configured client ID and client secret. |
| Content type | `application/x-www-form-urlencoded` |
| Grant type | `client_credentials` |
| Scope | `internal_user_mgt_list internal_group_mgt_view` |

The token is cached in memory per organization. The client tracks token expiry from `expires_in` and refreshes the token before reuse when it is close to expiry.

If a SCIM request receives `401`, the client invalidates the cached token, requests a fresh token, and retries the SCIM page once.

## SCIM Endpoints

The module fetches groups from:

```text
https://api.asgardeo.io/t/{organization}/scim2/Groups
```

The module fetches users from:

```text
https://api.asgardeo.io/t/{organization}/scim2/Users
```

Both requests send:

```text
Authorization: Bearer {token}
Accept: application/scim+json
```

## Sync Flow

Each provider run:

1. Resolves the organization.
2. Fetches SCIM groups.
3. Maps groups to Backstage `Group` entities.
4. Builds a map from SCIM group ID to Backstage group entity name.
5. Fetches SCIM users.
6. Maps users to Backstage `User` entities using the group ID map.
7. Applies a full catalog mutation containing all mapped users and groups.

The mutation type is:

```text
full
```

This means each successful run replaces this provider's current catalog output.

## Group Mapping

SCIM groups are mapped to Backstage `Group` entities.

The group display name is:

- `group.displayName`, or
- `group.id` when no display name exists.

If the display name contains a slash, only the final segment is used for the Backstage entity name.

Example:

```text
Internal/admin -> admin
```

Entity basics:

| Field | Value |
| --- | --- |
| `apiVersion` | `backstage.io/v1alpha1` |
| `kind` | `Group` |
| `metadata.name` | Normalized group name. |
| `metadata.description` | `Asgardeo group: {displayName}` |
| `spec.type` | `team` |
| `spec.children` | Empty array. |

Annotations:

| Annotation | Meaning |
| --- | --- |
| `backstage.io/managed-by-location` | `asgardeo:{organization}` |
| `backstage.io/managed-by-origin-location` | `asgardeo:{organization}` |
| `asgardeo.io/group-id` | SCIM group ID. |

## User Mapping

SCIM users are mapped to Backstage `User` entities.

### Email Resolution

The mapper determines email from:

1. First entry in `user.emails`.
2. `user.userName` when no email exists.

The first email can be either:

- A plain string.
- An object with a `value` property.

### User Name Resolution

The mapper starts from `user.userName` or email.

If the username contains a slash, only the final segment is used.

Example:

```text
DEFAULT/jane@example.com -> jane@example.com
```

Then the mapper:

- Takes the part before `@`.
- Replaces unsupported characters with dashes.
- Lowercases the result.

### Display Name Resolution

The profile display name is:

1. `user.name.formatted`
2. `user.name.givenName`
3. Cleaned username

### Group Membership Resolution

The mapper reads `user.groups`.

For each group reference:

1. It uses `grp.value` or the final path segment of `grp.$ref` as the SCIM group ID.
2. If that ID exists in the group ID map, it adds the mapped Backstage group name to `spec.memberOf`.
3. If no ID match exists but `grp.display` exists, it normalizes the display name and uses that.

Entity basics:

| Field | Value |
| --- | --- |
| `apiVersion` | `backstage.io/v1alpha1` |
| `kind` | `User` |
| `metadata.name` | Normalized username. |
| `spec.profile.displayName` | Resolved display name. |
| `spec.profile.email` | Resolved email. |
| `spec.memberOf` | Resolved Backstage group names. |

Annotations:

| Annotation | Meaning |
| --- | --- |
| `backstage.io/managed-by-location` | `asgardeo:{organization}` |
| `backstage.io/managed-by-origin-location` | `asgardeo:{organization}` |
| `asgardeo.io/user-id` | SCIM user ID. |

## Pagination

The module fetches SCIM list responses page by page using `startIndex` and `count`.

It continues requesting pages until the number of collected resources reaches `totalResults` or Asgardeo returns an empty page.

The page size is currently `100`.

## Error Handling

Group and user fetch failures throw errors.

Provider run behavior:

- Sync errors are caught and logged.
- The provider rethrows the error after logging so the scheduled task can be observed as failed.

## Current Source Details

- `catalog.providers.asgardeo.organization`, `clientId`, and `clientSecret` are required.
- `catalog.providers.asgardeo.baseUrl` is optional and defaults to `https://api.asgardeo.io/t/{organization}`.
- The role attribute setting is not used by this module.
