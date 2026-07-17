# WSO2 Plugin Suite User Docs

These documents explain how to use the local WSO2 Backstage plugin suite.

Use these docs if you are:

- Viewing WSO2 APIs, API products, MCP servers, services, or gateways in Backstage.
- Configuring Backstage so the WSO2 plugins can connect to WSO2 API Manager.
- Troubleshooting missing data or failed WSO2 actions from the UI.

For implementation details, backend routes, entity mapping, tests, and extension guidance, use [Developer Docs](../developer-docs/README.md).

## Documents

1. [Overview](./01-overview.md)
2. [Getting Started](./02-getting-started.md)
3. [Concepts](./03-concepts.md)
4. [Using the Plugin](./04-using-the-plugin.md)
5. [Configuration](./05-configuration.md)
6. [Troubleshooting](./06-troubleshooting.md)
7. [Reference](./07-reference.md)
8. [Visual Decision Guide](./08-visual-decision-guide.md)

## What This Plugin Suite Does

The WSO2 plugin suite connects Backstage to WSO2 API Manager and optionally to Asgardeo.

It can:

- Import WSO2 APIs into the Backstage catalog.
- Import WSO2 API Products into the Backstage catalog.
- Import WSO2 MCP servers into the Backstage catalog.
- Import WSO2 Service Catalog services into the Backstage catalog.
- Display WSO2-specific API information on catalog entity pages.
- Display API definitions, documents, gateway URLs, API product resources, and MCP tools.
- Support selected runtime actions such as API key generation, service definition download, WSDL download, gateway listing, and document download.
- Optionally sync Asgardeo users and groups into the Backstage catalog.
- Optionally allow Backstage sign-in through Asgardeo.
