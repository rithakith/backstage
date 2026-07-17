# Local Development

This page is intentionally developer-focused. For user-facing setup, refer to the user docs.

## Install Dependencies

From the repository root:

```powershell
yarn install --mode=skip-build
```

Use the repository's existing Yarn and Backstage CLI workflow.

## Build Packages

Run package builds from the package folder or through the repo's normal workspace command pattern.

Each local plugin package defines:

```text
backstage-cli package build
```

Relevant packages:

- `plugins/wso2-api-manager`
- `plugins/wso2-api-manager-backend`
- `plugins/catalog-backend-module-wso2-apim`
- `plugins/catalog-backend-module-asgardeo`
- `plugins/auth-backend-module-asgardeo-provider`

## Run Tests

Each package defines:

```text
backstage-cli package test
```

Run tests close to the package you changed when possible.

## Backend Registration

Confirm the WSO2 backend plugin is added to the Backstage backend entrypoint. The backend plugin must be loaded for:

- `discoveryApi.getBaseUrl('wso2-api-manager')`
- WSO2 runtime routes.
- Document and WSDL downloads.
- API key generation.
- Gateway and service runtime views.

Confirm the catalog backend module is added to the backend for catalog ingestion.

## Frontend Registration

Confirm the frontend plugin is added to the app and that entity cards are mounted where expected.

The package supports:

- Classic frontend plugin export from `src/plugin.ts`.
- Alpha frontend-system plugin export from `src/alpha/plugin.tsx`.

Use the registration style that matches the local Backstage app.

## Required Local Config

For local development against WSO2, the source requires at least:

- `wso2ApiManager.baseUrl`
- `wso2ApiManager.publisherBasePath`
- `wso2ApiManager.developerBasePath`
- `wso2ApiManager.auth.clientId`
- `wso2ApiManager.auth.clientSecret`
- `wso2ApiManager.auth.tokenUrl`
- `catalog.providers.wso2Apim.schedule`

Optional but commonly needed:

- `wso2ApiManager.serviceCatalogBasePath`
- `wso2ApiManager.tls.rejectUnauthorized`
- `wso2PlatformGateway`
- `catalog.providers.wso2Apim.namespace`
- `catalog.providers.asgardeo`

## Manual Verification

After backend and frontend are running:

1. Confirm the WSO2 catalog provider logs a successful ingestion count.
2. Open a generated WSO2 API entity in the catalog.
3. Confirm WSO2 annotations are present.
4. Confirm entity cards render without missing annotation errors.
5. Open the WSO2 API Manager page.
6. Confirm gateways load.
7. Confirm services load if the Service Catalog API is configured.
8. Test document download for an API with documents.
9. Test WSDL download for an API that has WSDL content.
10. Test API key generation only in an environment where service-account key generation is allowed.

## Local TLS

If local WSO2 uses a self-signed certificate, `wso2ApiManager.tls.rejectUnauthorized: false` can unblock development.

Do not assume that setting is acceptable for production.
