const fetch = require('node-fetch');

const clientId = 'FF1Ta0Ik9HoU18TbC8G_fOsQPBYa';
const clientSecret = 'UU0FWPdhvMf6PaDIxwU5zxiw3G5I0oMflKpf9ruQ6Zca';
const asgardeoOrgName = 'backstageplugin';

async function testSCIM() {
    try {
        console.log('1. Trying to get access token...');
        const tokenResponse = await fetch(`https://api.asgardeo.io/t/${asgardeoOrgName}/oauth2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                scope: 'internal_user_mgt_list internal_user_mgt_view internal_group_mgt_list internal_group_mgt_view'
            })
        });

        if (!tokenResponse.ok) {
            console.log('FAILED to get Token Status:', tokenResponse.status);
            console.log('FAILED to get Token Body:', await tokenResponse.text());
            return;
        }
        const tokenData = await tokenResponse.json();
        console.log('Token SUCCESS! Access Token snippet:', tokenData.access_token.substring(0, 10) + '...');

        console.log('\n2. Trying to fetch SCIM users...');
        const usersResponse = await fetch(`https://api.asgardeo.io/t/${asgardeoOrgName}/scim2/Users`, {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Accept': 'application/scim+json'
            }
        });

        if (!usersResponse.ok) {
            console.log('FAILED SCIM FETCH Status:', usersResponse.status);
            console.log('FAILED SCIM FETCH Body:', await usersResponse.text());
            return;
        }
        const usersData = await usersResponse.json();
        console.log('SCIM SUCCESS! Users array length:', usersData.Resources ? usersData.Resources.length : 0);
        console.log('First User:', JSON.stringify(usersData.Resources ? usersData.Resources[0] : 'None', null, 2));

    } catch (error) {
        console.log('EXCEPTION:', error);
    }
}
testSCIM();
