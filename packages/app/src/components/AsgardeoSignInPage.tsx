/*
 * Copyright 2026 The Backstage Authors
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

import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import {
  Content,
  Header,
  InfoCard,
  Page,
  UserIdentity,
} from '@backstage/core-components';
import {
  BackstageIdentityResponse,
  configApiRef,
  discoveryApiRef,
  errorApiRef,
  SignInPageProps,
  useAnalytics,
  useApi,
} from '@backstage/core-plugin-api';
import { useEffect, useState } from 'react';
import { asgardeoAuthApiRef } from '../apis';

const AUTH_READY_POLL_MS = 750;
const AUTH_READY_TIMEOUT_MS = 2500;

const toFriendlySignInError = (err: unknown) => {
  const message =
    err instanceof Error ? err.message : 'Unable to start sign in';

  if (/timed out|RPError|outgoing request/i.test(message)) {
    return new Error(
      'Sign-in is taking longer than expected. Please try again in a moment.',
    );
  }

  return err instanceof Error ? err : new Error(message);
};

export const AsgardeoSignInPage = ({
  onSignInSuccess,
}: SignInPageProps) => {
  const authApi = useApi(asgardeoAuthApiRef);
  const configApi = useApi(configApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const errorApi = useApi(errorApiRef);
  const analytics = useAnalytics();

  const [authReady, setAuthReady] = useState(false);
  const [checkingExistingSession, setCheckingExistingSession] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<Error>();

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const checkAuthBackend = async () => {
      try {
        const authBaseUrl = await discoveryApi.getBaseUrl('auth');
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          AUTH_READY_TIMEOUT_MS,
        );
        const response = await fetch(`${authBaseUrl}/.well-known/jwks.json`, {
          credentials: 'include',
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!cancelled && response.ok) {
          setAuthReady(true);
          return;
        }
      } catch {
        // The backend may still be compiling or starting. Keep polling.
      }

      if (!cancelled) {
        timer = setTimeout(checkAuthBackend, AUTH_READY_POLL_MS);
      }
    };

    checkAuthBackend();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [discoveryApi]);

  useEffect(() => {
    if (!authReady) {
      return () => {};
    }

    let cancelled = false;

    const loadExistingSession = async () => {
      setCheckingExistingSession(true);

      try {
        const identityResponse = await authApi.getBackstageIdentity({
          optional: true,
        });

        if (!cancelled && identityResponse) {
          const profile = await authApi.getProfile();
          onSignInSuccess(
            UserIdentity.create({
              identity: identityResponse.identity,
              authApi,
              profile,
            }),
          );
          analytics.captureEvent('signIn', 'success');
        }
      } catch (e) {
        // A cold backend should not surface as a login error before user action.
        console.warn('Asgardeo session check failed or timed out:', e);
      } finally {
        if (!cancelled) {
          setCheckingExistingSession(false);
        }
      }
    };

    loadExistingSession();

    return () => {
      cancelled = true;
    };
  }, [analytics, authApi, authReady, onSignInSuccess]);

  const completeSignIn = async (identityResponse: BackstageIdentityResponse) => {
    const profile = await authApi.getProfile();
    onSignInSuccess(
      UserIdentity.create({
        identity: identityResponse.identity,
        authApi,
        profile,
      }),
    );
    analytics.captureEvent('signIn', 'success');
  };

  const handleLogin = async () => {
    if (!authReady || signingIn) {
      return;
    }

    setSigningIn(true);
    setError(undefined);

    try {
      const identityResponse = await authApi.getBackstageIdentity({
        instantPopup: true,
      });

      if (!identityResponse) {
        throw new Error(
          'The Asgardeo provider is not configured to support sign-in',
        );
      }

      await completeSignIn(identityResponse);
    } catch (err) {
      const signInError = toFriendlySignInError(err);
      setError(signInError);
      errorApi.post(signInError);
    } finally {
      setSigningIn(false);
    }
  };

  const isBusy = !authReady || checkingExistingSession || signingIn;
  const statusText = !authReady
    ? 'Starting Backstage auth...'
    : checkingExistingSession
    ? 'Checking your session...'
    : 'Sign in with Asgardeo to continue.';

  return (
    <Page themeId="home">
      <Header title={configApi.getString('app.title')} />
      <Content>
        <Grid container justifyContent="center" spacing={2}>
          <Grid item xs={12} sm={8} md={5} lg={4}>
            <InfoCard
              variant="fullHeight"
              title="Sign in"
              actions={
                <Button
                  color="primary"
                  variant="outlined"
                  disabled={isBusy}
                  onClick={handleLogin}
                  startIcon={
                    isBusy ? <CircularProgress size={16} /> : undefined
                  }
                >
                  {signingIn ? 'Signing In' : 'Sign In'}
                </Button>
              }
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 8,
                  marginBottom: 16,
                }}
              >
                {isBusy && (
                  <CircularProgress
                    size={20}
                    style={{ color: '#ff5000', flexShrink: 0 }}
                  />
                )}
                <Typography variant="body2" color="textSecondary">
                  {statusText}
                </Typography>
              </div>

              {error && error.name !== 'PopupRejectedError' && (
                <Typography variant="body1" color="error">
                  {error.message}
                </Typography>
              )}
            </InfoCard>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
