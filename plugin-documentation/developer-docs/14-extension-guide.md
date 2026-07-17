# Extension Guide

Use this page when adding new WSO2 data, routes, cards, or entity annotations.

## Add a New Runtime Backend Route

Use a backend route when the frontend needs data that is dynamic, privileged, token-dependent, streamed, or unsuitable for catalog annotations.

Steps:

1. Add a method to `plugins/wso2-api-manager-backend/src/service/wso2Client.ts`.
2. Add a route in `plugins/wso2-api-manager-backend/src/service/router.ts`.
3. Call `ensureAuthenticated` unless the route is intentionally public.
4. Decide whether the route accepts `X-WSO2-Access-Token`.
5. Decide whether user-token `401` should fall back to service account.
6. Add or update router and client tests.
7. Add a method to `plugins/wso2-api-manager/src/api/types.ts`.
8. Implement the frontend client method in `Wso2ApiManagerClient`.
9. Add frontend API client tests.
10. Document the route in `08-api-reference.md`.

## Add a New Catalog Annotation

Use an annotation when the value is stable catalog metadata that should be available from entity pages and search/indexing workflows.

Steps:

1. Add the annotation in the relevant mapper under `catalog-backend-module-wso2-apim/src/lib/domains`.
2. Make the value a string. Use `JSON.stringify` for arrays or objects.
3. Add mapper tests for present, empty, and missing source fields.
4. Read the annotation in the frontend component.
5. Handle invalid JSON defensively in the frontend.
6. Document the annotation in `10-entity-model-and-annotations.md`.

## Add a New WSO2 Source Domain

Use this flow for a new WSO2 resource type.

1. Create a new folder under `src/lib/domains/{domain}`.
2. Add `types.ts` for WSO2 response shapes.
3. Add fetch utilities that use `Wso2Client`.
4. Add mapper utilities that return Backstage entities.
5. Export the domain utilities through the domain `index.ts`.
6. Call the fetcher and mapper from `Wso2DiscoveryService.discoverAll`.
7. Add provider/discovery tests.
8. Add mapper tests.
9. Add frontend display components if users need UI for the new resource.
10. Document the entity model and UI behavior.

## Add a New Frontend Entity Card

1. Create a component under `plugins/wso2-api-manager/src/components`.
2. Decide which entity kinds it supports.
3. Read current entity data through Backstage catalog React APIs.
4. Use existing annotation conventions.
5. Add a classic export if needed.
6. Add an alpha `EntityCardBlueprint` in `src/alpha/plugin.tsx` if the new frontend system should expose it.
7. Add component tests for missing annotations and malformed JSON.
8. Document the card in frontend internals and user docs.

## Add a New WSO2 Frontend Page Feature

1. Decide whether the data should come from catalog annotations or backend runtime routes.
2. If runtime data is needed, add backend route/client support first.
3. Add frontend API client method.
4. Add UI state for loading, error, empty, and success.
5. Avoid assuming a WSO2 user token is available.
6. Add tests for token and no-token behavior where relevant.

## Add Permission Checks

The inspected backend routes currently require Backstage user authentication but do not show route-level permission checks.

If adding permission checks:

1. Define permission names and resources.
2. Check permissions in backend routes before calling WSO2.
3. Update frontend UI to hide or disable restricted actions.
4. Add tests for allowed and denied access.
5. Document behavior in auth and user troubleshooting docs.

## Change Token Behavior

Before changing token fallback behavior, decide this policy explicitly:

- Should a WSO2 user token be required?
- Should a failed user token fall back to service account?
- Should service account behavior be route-specific?
- Should API key generation be user-scoped or service-account scoped?

Then update:

- Backend route.
- Backend client method signature.
- Frontend client method signature if needed.
- Tests.
- `07-authentication-and-authorization.md`.
- `08-api-reference.md`.

