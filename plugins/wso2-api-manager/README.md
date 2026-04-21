# WSO2 API Manager Frontend Plugin

The WSO2 API Manager Frontend Plugin provides a suite of components to visualize and interact with APIs hosted on WSO2 API Manager within the Backstage catalog.

## Installation

1. Install the package in your Backstage app:

```bash
yarn workspace app add @rk-apim/backstage-plugin-wso2-api-manager
```

2. Register the API factory in `packages/app/src/apis.ts`:

```typescript
import {
  Wso2ApiManagerClient,
  wso2ApiManagerApiRef,
} from '@rk-apim/backstage-plugin-wso2-api-manager';

export const apis = [
  // ...
  createApiFactory({
    api: wso2ApiManagerApiRef,
    deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
    factory: ({ discoveryApi, fetchApi }) =>
      new Wso2ApiManagerClient({ discoveryApi, fetchApi }),
  }),
];
```

3. Add the UI components to your `EntityPage.tsx`:

```tsx
import {
  EntityWso2AboutCard,
  EntityWso2ApiDefinitionCard,
  isWso2Api,
} from '@rk-apim/backstage-plugin-wso2-api-manager';

// ...

const apiPage = (
  <EntityLayout>
    <EntityLayout.Route path="/" title="Overview">
      <Grid container spacing={3}>
        <EntitySwitch>
          <EntitySwitch.Case if={isWso2Api}>
            <Grid item xs={12}>
              <EntityWso2AboutCard />
            </Grid>
          </EntitySwitch.Case>
        </EntitySwitch>
      </Grid>
    </EntityLayout.Route>
    <EntityLayout.Route path="/definition" title="Definition">
       <EntityWso2ApiDefinitionCard />
    </EntityLayout.Route>
  </EntityLayout>
);
```

## Features

- **About Card**: Displays API metadata, version, and endpoints.
- **Definition Card**: Integrated Swagger UI for testing REST APIs.
- **Overview Card**: Detailed documentation and usage instructions.
- **API Product Support**: Visualizes resources within API Products.
- **MCP Server Integration**: Displays tools and metadata for MCP-enabled entities.
