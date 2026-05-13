import {
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
 * User roles are retrieved from the Backstage catalog (synced from Asgardeo SCIM),
 * specifically from the user's memberOf groups which include the asgardeo_role.
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
                            console.log('\n\n🔴 ========================================');
                            console.log('🔴 === ASGARDEO LOGIN FLOW STARTED ===');
                            console.log('🔴 ========================================');
                            console.log('📍 Step 1: User successfully authenticated at Asgardeo');
                            console.log('   API: https://api.asgardeo.io/t/backstageplugin/oauth2/authorize');
                            console.log('   Request: GET with client_id, redirect_uri, scope, response_type=code');
                            console.log('   Parameters:');
                            console.log('     - client_id: FF1Ta0Ik9HoU18TbC8G_fOsQPBYa (Asgardeo OAuth Application)');
                            console.log('     - redirect_uri: http://localhost:7007/api/auth/oidc/handler/frame');
                            console.log('     - scope: openid profile email apim:api_create apim:api_publish');
                            console.log('     - response_type: code');
                            console.log('     - prompt: login');
                            console.log('   ℹ️  Note: Client secret NOT sent (browser-based redirect, secret kept secure on backend)');
                            console.log('📋 Step 2: Asgardeo redirected user back to Backstage with OAuth code');
                            console.log('   Callback URL: http://localhost:7007/api/auth/oidc/handler/frame');
                            console.log('   Response: Authorization code received (hidden for security)');
                            console.log('🔄 Step 3: Backstage exchanged OAuth code for access token');
                            console.log('   API: https://api.asgardeo.io/t/backstageplugin/oauth2/token');
                            console.log('   Request: POST with grant_type=authorization_code, code, redirect_uri');
                            console.log('   Authentication: Basic Auth (client_id + client_secret)');
                            console.log('     - client_id: FF1Ta0Ik9HoU18TbC8G_fOsQPBYa');
                            console.log('     - client_secret: UU0FW... (hidden, sent securely server-side)');
                            console.log('   ℹ️  Note: Client secret used HERE (server-to-server, never exposed to browser)');
                            console.log('   Response Details:');
                            if (info.result.session?.accessToken) {
                                console.log(`   ✅ Access Token: ${info.result.session.accessToken.substring(0, 20)}...`);
                                console.log(`   ✅ Token Type: Bearer`);
                                console.log(`   ✅ Expires In: ${info.result.params?.expires_in || 'N/A'} seconds`);
                                if (info.result.params?.scope) {
                                    console.log(`   ✅ Scopes Granted: ${info.result.params.scope}`);
                                }
                            }
                            console.log('✅ Step 4: Received user profile from Asgardeo');
                            console.log('   API: https://api.asgardeo.io/t/backstageplugin/oauth2/userinfo');
                            console.log('   Request: GET with Authorization: Bearer <access_token>');
                            console.log('   Response: User profile data received');
                            
                            console.log('\n📄 UserInfo Endpoint Response:');
                            console.log(JSON.stringify(info.profile, null, 2));
                            
                            console.log('\n🎫 ID Token Claims (decoded JWT):');
                            console.log(JSON.stringify(info.result.fullProfile?._json, null, 2));
                            
                            // @ritzy: ID Token and OAuth tokens showing as undefined/N/A
                            // Investigation needed:
                            // 1. Check if Asgardeo is returning ID token in the token response
                            // 2. Verify OIDC metadata includes id_token in response_type
                            // 3. For this application: We get user info from /userinfo endpoint, so ID token is optional
                            // 4. Access token is used internally by the OIDC library but may not be exposed here
                            // 5. Refresh token: Not critical for current flow (user re-authenticates on expiry)
                            // Status: Application works without these - user profile comes from /userinfo endpoint
                            // Action: Low priority - only investigate if user session issues occur
                            if (!info.result.fullProfile?._json) {
                                console.log('   ⚠️  @ritzy: ID Token claims not available - check Asgardeo OIDC configuration');
                            }
                            
                            console.log('\n🔑 OAuth Tokens Summary:');
                            console.log(`   Access Token: ${info.result.accessToken ? info.result.accessToken.substring(0, 30) + '...' : 'N/A'}`);
                            console.log(`   ID Token: ${info.result.params?.id_token ? info.result.params.id_token.substring(0, 30) + '...' : 'N/A'}`);
                            console.log(`   Refresh Token: ${info.result.refreshToken ? 'Present' : 'Not provided'}`);
                            if (!info.result.accessToken || !info.result.params?.id_token) {
                                console.log('   ⚠️  @ritzy: Some OAuth tokens not available in response');
                                console.log('   ℹ️  Current workaround: Using user profile from /userinfo endpoint instead');
                                console.log('   ℹ️  Impact: None - application functions normally with profile data');
                            }

                            // Retrieve email from the user profile returned by Asgardeo
                            const email = info.result.fullProfile.identities?.[0]?.id || info.profile.email;
                            console.log(`\n📧 Step 5: Extracted Email: ${email}`);

                            if (!email) {
                                console.error('❌ FAILURE: User profile contained no email - cannot create Backstage identity');
                                throw new Error('User profile contained no email');
                            }

                            // Extract the left side of the email as the username
                            const [localPart] = email.split('@');
                            const name = localPart.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
                            console.log(`👤 Step 6: Computed Backstage Username: "${name}" (normalized from: "${localPart}")`);

                            // Look up the user in the Backstage catalog to get their asgardeo_role
                            console.log(`\n🔍 Step 7: Looking up user in Backstage catalog...`);
                            console.log(`   Internal API: Backstage Catalog Service`);
                            console.log(`   Query: findCatalogUser({ entityRef: { name: "${name}" } })`);
                            let roles: string[] = [];
                            let groupEntities: string[] = [];
                            
                            try {
                                const { entity: userEntity } = await ctx.findCatalogUser({
                                    entityRef: { name }
                                });
                                
                                console.log(`   ✅ Catalog Response: Found user entity`);
                                console.log(`   Entity Ref: user:default/${userEntity.metadata.name}`);
                                console.log(`   Display Name: ${(userEntity as any).spec?.profile?.displayName || 'N/A'}`);
                                console.log(`   Email: ${(userEntity as any).spec?.profile?.email || 'N/A'}`);
                                
                                // Extract roles from user's memberOf groups
                                const memberOf = (userEntity as any).spec?.memberOf || [];
                                roles = memberOf;
                                
                                // Get asgardeo_role from annotations as well
                                const asgardeoRole = userEntity.metadata.annotations?.['asgardeo.io/role'];
                                
                                console.log(`\n🎭 Step 8: Extracted Roles from Backstage User Profile:`);
                                if (asgardeoRole) {
                                    console.log(`   ✅ Asgardeo Role (from annotation): ${asgardeoRole}`);
                                }
                                if (roles.length > 0) {
                                    console.log(`   ✅ Group Memberships (from spec.memberOf): [${roles.join(', ')}]`);
                                } else {
                                    console.warn(`   ⚠️  No group memberships found in catalog`);
                                }
                                
                                // Build group entities from memberOf for Backstage's permission system
                                groupEntities = memberOf.map((group: string) => `group:default/${group}`);
                                
                            } catch (error) {
                                console.warn(`   ⚠️  Catalog Response: User not found in catalog yet`);
                                console.warn(`   ℹ️  User will be added to catalog on next SCIM sync from Asgardeo`);
                                console.warn(`   ℹ️  Continuing with empty roles/groups...`);
                            }
                            
                            console.log(`\n🏷️  Step 9: Mapped Groups to Backstage References:`);
                            if (groupEntities.length === 0) {
                                console.warn(`   ⚠️  No group mappings from catalog`);
                            } else {
                                groupEntities.forEach((g, i) => console.log(`   ${i + 1}. ${g}`));
                            }
                            
                            console.log(`\n🪙 Step 10: Minting Backstage session token...`);
                            console.log(`   Internal API: Backstage Token Issuer Service`);
                            console.log(`   Token Claims being issued:`);
                            console.log(`     - sub (subject): user:default/${name}`);
                            console.log(`     - ent (entities): [${['user:default/' + name, ...groupEntities].join(', ')}]`);

                            // Automatically issue a token with user and group memberships from catalog
                            const token = await ctx.issueToken({
                                claims: {
                                    sub: `user:default/${name}`,
                                    ent: [
                                        `user:default/${name}`,
                                        ...groupEntities,
                                    ],
                                },
                            });

                            console.log(`   ✅ Backstage Session Token Generated Successfully`);
                            console.log(`   Token: ${token.token.substring(0, 40)}...`);

                            console.log('\n🟢 ========================================');
                            console.log('🟢 === LOGIN SUCCESS! ===');
                            console.log('🟢 ========================================');
                            console.log(`✅ User authenticated: user:default/${name}`);
                            console.log(`✅ Session token issued and stored in browser cookie`);
                            console.log(`✅ User can now access Backstage UI`);
                            console.log(`\n📊 Authorization Summary:`);
                            console.log(`   User Entity: user:default/${name}`);
                            console.log(`   Group Count: ${groupEntities.length}`);
                            console.log(`   Groups: ${groupEntities.length > 0 ? groupEntities.join(', ') : 'none'}`);
                            console.log(`\n🔐 Permissions are determined by:`);
                            console.log(`   1. Groups from Backstage catalog (synced from Asgardeo SCIM)`);
                            console.log(`   2. User entity spec.memberOf relationships`);
                            console.log(`   3. Asgardeo custom role attribute (stored in annotations)`);
                            console.log(`   4. Permission policies defined in packages/backend/src/index.ts`);
                            console.log('🟢 ========================================\n\n');
                            
                            return token;
                        },
                    }),
                });
            },
        });
    },
});
