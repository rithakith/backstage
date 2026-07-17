# Getting Started

---

## Prerequisites

Before installing the plugin suite, ensure you have set up the following:

- **Backstage Instance**: A running Backstage instance (either running locally or deployed). If you are new to Backstage, refer to the [Backstage Getting Started Guide](https://backstage.io/docs/getting-started/).
- **WSO2 API Manager**: WSO2 API Manager version **4.2.0 or above** must be running and accessible. For installation instructions, see the [WSO2 API Manager Documentation](https://apim.docs.wso2.com/).
- **(Optional) Self-Hosted Gateways**: If you want to discover and display configured WSO2 API Platform self-hosted gateways and their deployed endpoints directly in Backstage, ensure those gateway endpoints are accessible. Detailed setup instructions can be found in the [Configuration Guide](file:///c:/Users/ritzy/Desktop/backstage/plugin-documentation/user-docs/05-configuration.md#self-hosted-gateways).

---

## Adding Plugins

The WSO2 Backstage plugin suite consists of frontend, backend, and catalog backend module packages. Run the following commands to install them:

### 1. Install Core WSO2 APIM Plugins

Add the frontend package to your Backstage application, and the backend/catalog packages to your Backstage backend:

```bash
# Add the frontend plugin
yarn --cwd packages/app add @local/backstage-plugin-wso2-api-manager

# Add the backend plugin and catalog backend module
yarn --cwd packages/backend add @local/backstage-plugin-wso2-api-manager-backend @local/backstage-plugin-catalog-backend-module-wso2-apim
```

### 2. Install Asgardeo Identity Plugins (Optional)

If your organization uses Asgardeo as its Identity Provider (IdP) and you want to sync users/groups or enable single sign-on (SSO), add the Asgardeo modules:

```bash
# Add the Asgardeo catalog sync and auth provider modules
yarn --cwd packages/backend add @local/backstage-plugin-catalog-backend-module-asgardeo @local/backstage-plugin-auth-backend-module-asgardeo-provider
```

---

## Setting the Configuration

Once the packages are installed, configure your Backstage instance by editing the `app-config.yaml` file. 

Add the minimum configuration required for connecting to WSO2 API Manager and scheduling catalog ingestion:

```yaml
wso2ApiManager:
  baseUrl: https://<your-wso2-api-manager-host>
  publisherBasePath: /api/am/publisher/v4
  developerBasePath: /api/am/devportal/v3
  serviceCatalogBasePath: /api/am/service-catalog/v1
  auth:
    clientId: ${WSO2_CLIENT_ID}
    clientSecret: ${WSO2_CLIENT_SECRET}
    tokenUrl: https://<your-wso2-api-manager-host>/oauth2/token

catalog:
  providers:
    wso2Apim:
      namespace: default
      schedule:
        frequency: { minutes: 30 }
        timeout: { minutes: 5 }
        initialDelay: { seconds: 5 }
```

> [!TIP]
> For advanced configurations, including self-hosted gateways and Asgardeo integration details, view the full [Configuration Guide](file:///c:/Users/ritzy/Desktop/backstage/plugin-documentation/user-docs/05-configuration.md).

---

## Setup Verification

After completing the configuration and restarting your Backstage backend, verify your setup.

### Success State

If configured correctly, the WSO2 catalog provider will successfully ingest your APIs and resources into the Backstage catalog.

![Setup Success Placeholder](../assets/getting-started-success.png)
_Example of successful WSO2 API entity catalog ingestion._

### Failure State

If there is a connection issue, missing credentials, or configuration mismatch, the ingestion logs will display warning or error messages, and no entities will appear.

![Setup Failure Placeholder](../assets/getting-started-failure.png)
_Example showing a failed connection or auth error during ingestion._

> [!IMPORTANT]
> If you experience issues during verification, check your backend console logs for connection, token, or permission errors. You can also refer to the [Troubleshooting Guide](file:///c:/Users/ritzy/Desktop/backstage/plugin-documentation/user-docs/06-troubleshooting.md).
