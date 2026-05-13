const https = require('https');
const fetch = require('node-fetch');

const baseUrl = 'https://localhost:9447';
const username = 'admin';
const password = 'admin';
const clientId = 'BhetwS48ZQMrVf4bzxNZ1279Ifwa';
const clientSecret = 'lw1aTWxSasQ2mX0t2oSFp2Zopgoa';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

(async () => {
    try {
        console.log('Fetching WSO2 token...');
        const tokenResponse = await fetch(`${baseUrl}/oauth2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
            },
            body: new URLSearchParams({
                grant_type: 'password',
                username: username,
                password: password,
                scope: 'apim:api_view'
            }),
            agent: httpsAgent,
        });

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        console.log('Acquired access token.');

        console.log('Fetching APIs...');
        const apisResponse = await fetch(`${baseUrl}/api/am/publisher/v4/apis?limit=2`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            },
            agent: httpsAgent,
        });

        const apisData = await apisResponse.json();
        if (apisData.list && apisData.list.length > 0) {
            const apiId = apisData.list[0].id;
            console.log(`Fetching documents for API ID: ${apiId}`);
            const docsUrl = `${baseUrl}/api/am/publisher/v4/apis/${apiId}/documents`;
            console.log(`Request URL: ${docsUrl}`);
            const docsResponse = await fetch(docsUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                },
                agent: httpsAgent,
            });
            const docsData = await docsResponse.json();
            console.log(`\n--- DOCUMENT RESPONSE FORMAT ---`);
            console.log(JSON.stringify(docsData, null, 2));
            console.log(`--------------------------------\n`);
        } else {
            console.log('No APIs found.');
        }
    } catch (err) {
        console.error('Error:', err);
    }
})();
