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

import {
  commonSignInResolvers,
  createSignInResolverFactory,
  SignInResolver,
  SignInResolverFactory,
} from '@backstage/plugin-auth-node';

/**
 * Helper to wrap a catalog-based sign-in resolver with a fallback.
 * If the user is not found in the catalog (e.g. during initial sync delay),
 * it falls back to direct token issuance using the email prefix.
 */
function wrapWithCatalogFallback<TAuthResult>(
  resolverFactory: SignInResolverFactory<TAuthResult, undefined>,
): SignInResolverFactory<TAuthResult, undefined> {
  return createSignInResolverFactory({
    create(): SignInResolver<TAuthResult> {
      const resolver = resolverFactory();

      return async (info, ctx) => {
        try {
          return await resolver(info, ctx);
        } catch (error) {
          if (
            !(
              error &&
              typeof error === 'object' &&
              'name' in error &&
              error.name === 'NotFoundError'
            )
          ) {
            throw error;
          }

          const email = info.profile.email;
          if (!email) {
            throw error;
          }

          const localPart = email.split('@')[0];
          const userRef = `user:default/${localPart}`;

          console.warn(
            `[Asgardeo-Auth] User "${userRef}" not found in catalog (sync may still be in progress). Falling back to direct token issuance. Error: ${error}`,
          );

          return ctx.issueToken({
            claims: {
              sub: userRef,
              ent: [userRef],
            },
          });
        }
      };
    },
  });
}

/**
 * Available sign-in resolvers for the Asgardeo auth provider.
 *
 * @public
 */
export namespace asgardeoSignInResolvers {
  /**
   * Looks up the Backstage user using the local part of the Asgardeo email
   * address as the catalog entity name.
   */
  export const emailLocalPartMatchingUserEntityName = wrapWithCatalogFallback(
    commonSignInResolvers.emailLocalPartMatchingUserEntityName,
  );

  /**
   * Looks up the Backstage user using the Asgardeo email address as
   * `spec.profile.email` on the catalog user entity.
   */
  export const emailMatchingUserEntityProfileEmail = wrapWithCatalogFallback(
    commonSignInResolvers.emailMatchingUserEntityProfileEmail,
  );
}
