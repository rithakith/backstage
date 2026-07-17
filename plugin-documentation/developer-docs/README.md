# WSO2 Plugin Suite Developer Docs

These documents describe the implementation and maintenance details for the local WSO2 and Asgardeo Backstage plugins.

Use the user documentation for installation, first-time setup, and normal UI workflows. These developer docs intentionally avoid repeating that material except where setup details affect implementation behavior.

## Documents

1. [Overview](./01-overview.md)
2. [Plugin Suite Architecture](./02-plugin-suite-architecture.md)
3. [Package Structure](./03-package-structure.md)
4. [Frontend Plugin Internals](./04-frontend-plugin-internals.md)
5. [Backend Plugin Internals](./05-backend-plugin-internals.md)
6. [Catalog Ingestion Internals](./06-catalog-ingestion-internals.md)
7. [Authentication and Authorization](./07-authentication-and-authorization.md)
8. [API Reference](./08-api-reference.md)
9. [Configuration Reference](./09-configuration-reference.md)
10. [Entity Model and Annotations](./10-entity-model-and-annotations.md)
11. [Error Handling and Logging](./11-error-handling-and-logging.md)
12. [Local Development](./12-local-development.md)
13. [Testing Guide](./13-testing-guide.md)
14. [Extension Guide](./14-extension-guide.md)
15. [Release and Maintenance](./15-release-and-maintenance.md)

## Source Scope

The docs are based on the current source under:

- `plugins/wso2-api-manager`
- `plugins/wso2-api-manager-backend`
- `plugins/catalog-backend-module-wso2-apim`
- `plugins/catalog-backend-module-asgardeo`
- `plugins/auth-backend-module-asgardeo-provider`

When a behavior is not fully proven by the inspected source, the relevant page marks it as a review note or implementation gap.
