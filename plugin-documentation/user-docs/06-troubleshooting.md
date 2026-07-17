# Troubleshooting

Use this page when WSO2 data is missing or a WSO2 action fails in Backstage.

## No WSO2 APIs Appear in the Catalog

Check:

- The WSO2 APIM catalog backend module is registered.
- `catalog.providers.wso2Apim.schedule` is configured.
- `wso2ApiManager.baseUrl` is correct.
- `wso2ApiManager.publisherBasePath` is correct.
- The service-account client id and secret are correct.
- The token URL is correct.
- The service account has scopes to read WSO2 APIs.
- Backend logs show a successful WSO2 provider ingestion count.

## API Appears but WSO2 Cards Are Empty

Check:

- The entity has WSO2 annotations such as `wso2.com/api-id`.
- The entity has a usable `spec.definition` if the definition card should render a definition.
- The catalog sync completed after the API was added or changed in WSO2.
- The API type is supported by the frontend card.

Some cards intentionally do not render when their required annotations are missing.

## Documents Are Missing

Check:

- The WSO2 API has documents in WSO2 API Manager.
- The catalog provider was able to fetch document metadata.
- The entity has `wso2.com/api-documents`.
- The document annotation contains valid JSON.

If document metadata appears but content download fails, check the backend plugin and WSO2 document content endpoint.

## WSDL Download Fails

Check:

- The API supports WSDL content in WSO2.
- The backend plugin is registered.
- The user is authenticated in Backstage.
- WSO2 Publisher base path is correct.
- The service account or user token has permission to read the WSDL.
- Backend logs show the upstream WSO2 status.

## API Key Generation Fails

Check:

- The backend plugin is registered.
- `developerBasePath` is configured.
- `auth.tokenUrl`, `clientId`, and `clientSecret` are correct.
- The service account has the required WSO2 scope for API key generation.
- The API id is present in the entity annotation.
- The API type and discovery type allow key generation in the UI.

Known behavior: the inspected backend route authenticates the Backstage user, but API key generation uses the service-account path.

## Gateway List Is Empty

Check:

- WSO2 Publisher settings are reachable.
- The service account has permission to read Publisher settings.
- `wso2PlatformGateway` is configured if you expect self-hosted gateways.
- Each configured gateway has valid `urls`.
- `discoveryUrl` is reachable if gateway discovery should run.
- Discovery credentials are correct if the gateway requires Basic auth.

## Service List Is Empty

Check:

- `wso2ApiManager.serviceCatalogBasePath` is correct.
- The WSO2 Service Catalog API is enabled and reachable.
- The service account has permission to read services.
- Backend logs show whether Service Catalog calls are failing.

## Health Check Fails

The frontend client includes a `GET /health` call, and the backend plugin registers auth policy for `/health`.

However, the inspected backend router does not define `GET /health`.

If only the health check fails while other WSO2 actions work, treat this as a current implementation gap.

## Refresh Button Does Not Immediately Update Catalog Data

The current `/refresh` route logs the request and returns a message.

The inspected source does not directly trigger the catalog provider. Catalog data updates on the scheduled provider run.

If immediate refresh is required, developers need to add a real trigger mechanism.

## Asgardeo Sign-In Fails

Check:

- The `asgardeo` auth provider is configured.
- OIDC client id, secret, issuer, and callback URL are correct.
- The selected sign-in resolver matches the Backstage catalog user entities.
- Asgardeo users are synced into the catalog if the resolver depends on catalog users.

## Asgardeo Users or Groups Are Missing

Check:

- The Asgardeo catalog backend module is registered.
- `catalog.providers.asgardeo.organization` is correct.
- SCIM credentials and base URL are correct.
- The provider schedule has run.
- Backend logs show user and group fetch counts.
