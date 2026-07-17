# Release and Maintenance

## Versioned Packages

The local WSO2 packages have independent package versions:

| Package | Current inspected version |
| --- | --- |
| `@local/backstage-plugin-wso2-api-manager` | `0.0.4` |
| `@local/backstage-plugin-wso2-api-manager-backend` | `0.0.3` |
| `@local/backstage-plugin-catalog-backend-module-wso2-apim` | `0.0.2` |
| `@local/backstage-plugin-catalog-backend-module-asgardeo` | `0.0.2` |

The Asgardeo auth backend module package version was not inspected in this pass. Check its `package.json` before release notes mention a version.

## Release Checklist

Before releasing plugin changes:

1. Update package versions according to the local release policy.
2. Run tests for every changed package.
3. Build every changed package.
4. Verify backend registration still loads.
5. Verify frontend registration still loads.
6. Run a catalog sync against a known WSO2 environment.
7. Check generated entity annotations.
8. Smoke test WSO2 UI pages and entity cards.
9. Smoke test backend runtime routes changed by the release.
10. Update user docs and developer docs for changed behavior.

## Backstage Upgrade Considerations

Watch these areas during Backstage upgrades:

- `@backstage/frontend-plugin-api` alpha APIs.
- `EntityCardBlueprint` from `@backstage/plugin-catalog-react/alpha`.
- Backend plugin service dependency names.
- Catalog processing extension points.
- Auth provider factory APIs.
- Permission APIs if route-level permissions are added later.

Alpha frontend APIs may change faster than stable plugin APIs.

## Config Migration Notes

Config changes should include:

- Example config update in user docs.
- Full field behavior in developer docs.
- Schema updates in `config.d.ts`.
- Notes about defaults and backward compatibility.

Current config items to review before release:

- Add `developerBasePath` to backend `config.d.ts` if it remains required.
- Align optional vs required gateway discovery credentials between runtime backend and catalog provider.
- Decide whether `auth.tokenUrl` should be optional or required consistently across runtime backend and catalog module.

## Known Limitations

| Limitation | Impact |
| --- | --- |
| `/refresh` does not directly trigger provider execution | Users receive a success-style message, but the catalog refresh depends on scheduled provider behavior. |
| `GET /health` is referenced but not implemented in inspected router | Frontend health checks may fail until the route is implemented or frontend call is removed. |
| API key generation uses service-account path in inspected source | Generated keys may not reflect the WSO2 user token supplied by the frontend. |
| Some fetchers silently return placeholders or empty arrays | Catalog sync can succeed with incomplete docs, definitions, products, MCP documents, or services. |
| Gateway discovery logs can be verbose | Production logs may include more gateway response detail than desired. |

## Maintenance Priorities

Recommended near-term cleanup:

1. Decide and fix `/health` behavior.
2. Align config schema with runtime requirements.
3. Decide API key generation token policy.
4. Decide service-account fallback policy route by route.
5. Add permission checks for sensitive operations if required.
6. Add tests for config edge cases and route auth behavior.
7. Reduce or gate verbose gateway discovery logs if production log hygiene requires it.

## Documentation Maintenance

When changing source behavior, update docs in the same change.

Use this mapping:

| Source change | Docs to update |
| --- | --- |
| New backend route | API Reference, Backend Internals, Testing Guide. |
| New annotation | Entity Model and Annotations, Frontend Internals, Testing Guide. |
| New WSO2 source domain | Catalog Ingestion Internals, Entity Model and Annotations, Extension Guide. |
| Auth/token behavior change | Authentication and Authorization, API Reference. |
| Config change | Configuration Reference and user setup docs. |
| Frontend card/page change | Frontend Plugin Internals and user docs. |
