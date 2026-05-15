/*
 * Copyright 2026 WSO2 LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useState, useEffect, useRef } from 'react';
import { useAsyncRetry } from 'react-use';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { wso2ApiManagerApiRef, wso2AuthApiRef } from '../../../api';

export const useWso2ApiAuth = (options: {
  apiId?: string;
  isApiPlatform: boolean;
}) => {
  const { apiId, isApiPlatform } = options;
  const apiClient = useApi(wso2ApiManagerApiRef);
  const oauthApi = useApi(wso2AuthApiRef);
  const alertApi = useApi(alertApiRef);

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const apiKeyRef = useRef<string | null>(null);

  const tokenState = useAsyncRetry(async () => {
    try {
      return await oauthApi.getAccessToken(
        [
          'openid',
          'profile',
          'email',
          'apim:api_view',
          'apim:api_generate_key',
          'apim:api_manage',
          'apim:subscribe',
          'apim:app_manage',
          'apim:api_key',
        ],
        { optional: true },
      );
    } catch (error: any) {
      console.error('[WSO2-ApiAuth] Token retrieval failed:', error);
      return undefined;
    }
  }, [oauthApi]);

  const [customKeyName, setCustomKeyName] = useState('Backstage_Key');
  
  const [shouldGenerate, setShouldGenerate] = useState(false);
  
  const generateKeyState = useAsyncRetry(async () => {
    if (!apiId || isApiPlatform || !shouldGenerate) {
      return undefined;
    }
    try {
      return await apiClient.generateApiKey(apiId, { keyName: customKeyName });
    } catch (e: any) {
      console.error('[WSO2-ApiAuth] Failed to generate API Key:', e.message);
      return null;
    }
  }, [apiClient, apiId, isApiPlatform, shouldGenerate]);

  const refreshKey = (name?: string) => {
    if (name) {
      setCustomKeyName(name);
    }
    if (!shouldGenerate) {
      setShouldGenerate(true);
    } else {
      generateKeyState.retry();
    }
  };

  const applyManualKey = (key: string) => {
    setApiKey(key);
    apiKeyRef.current = key;
    setExpiresIn(null); // Manual keys might not have known expiry
  };

  useEffect(() => {
    if (generateKeyState.value) {
      const keyData = generateKeyState.value;
      const key = keyData.apikey || keyData.internalKey;

      const isInitial = apiKeyRef.current === null;
      apiKeyRef.current = key || null;
      setApiKey(key || null);
      setLastUpdated(Date.now());

      const validity = keyData.validityPeriod || keyData.expires_in;
      if (validity) {
        setExpiresIn(Number(validity));
      }

      if (!isInitial && key) {
        alertApi.post({
          message: 'API Key refreshed',
          severity: 'success',
          display: 'transient',
        });
      }
    } else if (generateKeyState.error) {
      apiKeyRef.current = null;
      setApiKey(null);
    }
  }, [generateKeyState.value, generateKeyState.error, alertApi]);

  return {
    token: tokenState.value,
    isTokenLoading: tokenState.loading,
    apiKey,
    apiKeyRef,
    expiresIn,
    lastUpdated,
    isKeyLoading: generateKeyState.loading,
    generateKeyError: generateKeyState.value === null,
    refreshKey,
    applyManualKey,
    customKeyName,
    setCustomKeyName,
  };
};
