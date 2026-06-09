# @local/backstage-plugin-auth-backend-module-asgardeo-provider

This backend module adds an `asgardeo` auth provider to the Backstage auth backend.

## Installation

Add the module to your backend:

```ts
backend.add(
  import('@local/backstage-plugin-auth-backend-module-asgardeo-provider'),
);
```

Configure the provider:

```yaml
auth:
  providers:
    asgardeo:
      production:
        clientId: ${ASGARDEO_CLIENT_ID}
        clientSecret: ${ASGARDEO_CLIENT_SECRET}
        metadataUrl: https://api.asgardeo.io/t/${ASGARDEO_ORGANIZATION}/oauth2/token/.well-known/openid-configuration
        additionalScopes: openid profile email
        prompt: login
        signIn:
          resolvers:
            - resolver: emailLocalPartMatchingUserEntityName
```
