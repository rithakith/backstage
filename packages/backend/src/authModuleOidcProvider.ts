import {
    coreServices,
    createBackendModule,
} from '@backstage/backend-plugin-api';
import {
    authProvidersExtensionPoint,
    createOAuthProviderFactory,
} from '@backstage/plugin-auth-node';

// We import the authenticator from the existing OIDC provider package.
import { oidcAuthenticator } from '@backstage/plugin-auth-backend-module-oidc-provider';

/**
 * Creates a custom OIDC authentication provider module for Backstage.
 * It overrides the default sign-in resolver so it DOES NOT check the catalog.
 * Instead, it dynamically issues a token for anyone who successfully logs into Asgardeo.
 */
export default createBackendModule({
    pluginId: 'auth',
    moduleId: 'custom-oidc-provider',
    register(reg) {
        reg.registerInit({
            deps: {
                providers: authProvidersExtensionPoint,
            },
            async init({ providers }) {
                providers.registerProvider({
                    providerId: 'oidc',
                    factory: createOAuthProviderFactory({
                        authenticator: oidcAuthenticator,
                        async signInResolver(info, ctx) {
                            // Retrieve email from the user profile returned by Asgardeo
                            const email = info.result.fullProfile.identities?.[0]?.id || info.profile.email;
                            if (!email) {
                                throw new Error('User profile contained no email');
                            }

                            // Extract the left side of the email as the username
                            const [localPart] = email.split('@');
                            const name = localPart.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();

                            // Automatically issue a token without checking the Backstage catalog!
                            return ctx.issueToken({
                                claims: {
                                    sub: `user:default/${name}`,
                                    ent: [`user:default/${name}`],
                                },
                            });
                        },
                    }),
                });
            },
        });
    },
});
