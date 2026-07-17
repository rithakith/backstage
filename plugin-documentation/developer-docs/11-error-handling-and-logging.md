# Error Handling and Logging

## Runtime Backend Routes

Most backend routes catch errors and return:

```json
{
  "message": "error message"
}
```

with status:

```text
500
```

Streaming routes may return upstream status codes and response text directly.

## WSO2 Error Extraction

The runtime backend client reads failed WSO2 response bodies as text, then tries to parse JSON.

If the JSON contains both `message` and `description`, the client combines them:

```text
{message}: {description}
```

Otherwise it falls back to:

1. `message`
2. `description`
3. Raw body
4. Response status text
5. `Status {status}`

## Runtime Backend Logging

The backend route/client logs:

- Router initialization.
- Manual refresh requests.
- API key generation attempts and failures.
- Gateway fetch failures.
- Gateway discovery attempts, response shapes, and failures.
- WSO2 client context: user token vs service-account token.
- 401 fallback from user token to service-account token.
- Stream read errors.

Review note: gateway discovery currently logs detailed response information, including API names and sometimes serialized response snippets. Confirm whether this is acceptable in production logs.

## Catalog Module Retry and Errors

The catalog `Wso2Client` retries WSO2 GET requests up to three times unless the failure is most 4xx responses.

It does not retry 4xx responses except:

- `401`
- `429`

On `401`, it clears the cached access token before retrying.

If all attempts fail, it throws the last error.

## Catalog Provider Errors

`Wso2ApiEntityProvider.run` catches discovery errors and logs:

```text
[WSO2 Provider] Sync Error: ...
```

It does not rethrow after logging in the inspected source.

Developer implication: scheduled task failure visibility depends on logs. If platform operators need task failure alerts, consider rethrowing or adding explicit metrics/events.

## Fetcher-Level Error Handling

Some domain fetchers catch errors and return partial results:

| Fetcher | Failure behavior |
| --- | --- |
| API detail fetch | Logs error and returns summary-enriched object. |
| API document fetch | Silent catch and returns `[]`. |
| API definition fetch | Returns placeholder string. |
| API product list/detail fetch | Logs error and returns partial or empty list. |
| API product definition fetch | Silent catch and returns placeholder string. |
| MCP list/detail fetch | Logs error and returns partial or empty list. |
| MCP document fetch | Silent catch and returns `[]`. |
| Service list fetch | Logs error and returns `[]`. |

Review note: silent catches make catalog sync resilient, but they can hide incomplete metadata. Consider adding debug logs if missing documents or definitions are hard to diagnose.

## Frontend Error Handling

The frontend API client throws errors for non-OK responses in this format:

```text
WSO2 API request failed [{status}]: {response text}
```

If JSON parsing fails, it throws:

```text
Failed to parse WSO2 API response: {text}
```

Components using the client should render these errors in user-safe UI and avoid exposing secrets from backend messages.

## Debugging Checklist

When WSO2 data is missing:

1. Check the catalog provider schedule and logs.
2. Confirm `wso2ApiManager.baseUrl`, `publisherBasePath`, token URL, and scopes.
3. Confirm service-account token acquisition.
4. Check whether fetchers returned placeholders or empty lists.
5. Inspect generated entity annotations in the catalog.
6. Confirm the frontend card reads the annotation key the mapper writes.

When a frontend runtime operation fails:

1. Confirm the backend plugin is registered with plugin id `wso2-api-manager`.
2. Confirm `discoveryApi.getBaseUrl('wso2-api-manager')` resolves.
3. Check Backstage user authentication.
4. Check whether `X-WSO2-Access-Token` is sent when expected.
5. Check WSO2 upstream status and backend logs.
