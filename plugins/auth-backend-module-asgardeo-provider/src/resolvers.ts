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

import { commonSignInResolvers } from '@backstage/plugin-auth-node';

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
  export const emailLocalPartMatchingUserEntityName =
    commonSignInResolvers.emailLocalPartMatchingUserEntityName;

  /**
   * Looks up the Backstage user using the Asgardeo email address as
   * `spec.profile.email` on the catalog user entity.
   */
  export const emailMatchingUserEntityProfileEmail =
    commonSignInResolvers.emailMatchingUserEntityProfileEmail;
}
