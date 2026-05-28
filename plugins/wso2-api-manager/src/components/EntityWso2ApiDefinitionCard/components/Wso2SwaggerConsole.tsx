import React from 'react';
// @ts-ignore
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

interface Wso2SwaggerConsoleProps {
  swaggerSpec: any;
  tryItOutPlugin: any;
  apiKeyRef: React.MutableRefObject<string | null>;
  externalApiKey: string;
  apiKeyAuthPolicy: any;
}

export const Wso2SwaggerConsole = ({
  swaggerSpec,
  tryItOutPlugin,
  apiKeyRef,
  externalApiKey,
  apiKeyAuthPolicy,
}: Wso2SwaggerConsoleProps) => {
  return (
    <SwaggerUI
      spec={swaggerSpec}
      plugins={[tryItOutPlugin]}
      supportedSubmitMethods={[
        'get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace',
      ]}
      requestInterceptor={(req: any) => {
        const currentKey = apiKeyRef.current;
        if (currentKey !== null) {
          req.headers['ApiKey'] = currentKey;
        }
        if (externalApiKey && apiKeyAuthPolicy) {
          const { in: location, key } = apiKeyAuthPolicy.params || {};
          if (location === 'header') {
            req.headers[key || 'x-api-key'] = externalApiKey;
          } else if (location === 'query') {
            const separator = req.url.includes('?') ? '&' : '?';
            req.url = `${req.url}${separator}${key || 'api-key'}=${encodeURIComponent(externalApiKey)}`;
          }
        }
        return req;
      }}
    />
  );
};
