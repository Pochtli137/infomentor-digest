/**
 * InfoMentor OAuth2 authentication.
 *
 * Flow: refresh_token → access_token → SSO one-time URL → redirect chain → web session cookies.
 *
 * The refresh token was obtained via a one-time BankID login. It rotates on
 * each use (the new refresh_token must be saved). The access token expires
 * in 10 minutes, but we only need it briefly for the SSO bridge.
 *
 * OAuth2 credentials are from the official InfoMentor Android app (public,
 * hardcoded in the APK — not secrets).
 */
// These are public OAuth2 client credentials from the InfoMentor Android app.
// They are not secrets — they are hardcoded in the published APK.
const OAUTH_CLIENT_ID = 'notificationapp';
const OAUTH_CLIENT_SECRET = 'NONE';
const OAUTH_SCOPE = 'IM2-API-NOTIFICATION';
const TOKEN_URL = 'https://im.infomentor.se/Authentication/OAuth2/Token';
const SSO_URL = 'https://api-im.infomentor.se/NA1/Authentication/sso';
/**
 * Authenticate with InfoMentor using a refresh token.
 * Returns web session cookies that can be used with the Hub API.
 */
export async function authenticate(refreshToken) {
    // Step 1: Refresh the OAuth2 access token
    const refreshRes = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: OAUTH_CLIENT_ID,
            client_secret: OAUTH_CLIENT_SECRET,
            grant_type: 'refresh_token',
            scope: OAUTH_SCOPE,
        }),
    });
    if (!refreshRes.ok)
        return null;
    const tokenResp = (await refreshRes.json());
    const accessToken = tokenResp.access_token;
    const newRefreshToken = tokenResp.refresh_token;
    if (!accessToken || !newRefreshToken)
        return null;
    // Step 2: Get SSO one-time login URL
    const ssoRes = await fetch(SSO_URL, {
        headers: { Authorization: 'Bearer ' + accessToken },
    });
    const ssoRaw = await ssoRes.text();
    const ssoLoginUrl = ssoRaw.replace(/^"|"$/g, '');
    if (!ssoLoginUrl.startsWith('http'))
        return null;
    // Step 3: Follow the SSO redirect chain to establish a web session
    // R1: SSO URL → redirect to hub login page
    const r1 = await fetch(ssoLoginUrl, { redirect: 'manual' });
    const cookieParts = (r1.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]);
    const hubLoginUrl = r1.headers.get('location');
    if (!hubLoginUrl)
        return null;
    // R2: Hub login page → auto-submit form with oauth_token
    const r2 = await fetch(hubLoginUrl, {
        headers: { Cookie: cookieParts.join('; ') },
        redirect: 'manual',
    });
    const formHtml = await r2.text();
    const oauthToken = formHtml.match(/name="oauth_token" value="([^"]+)"/)?.[1];
    if (!oauthToken)
        return null;
    // R3: Submit the oauth_token form
    const r3 = await fetch('https://infomentor.se/swedish/production/mentor/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: cookieParts.join('; '),
        },
        body: 'oauth_token=' + encodeURIComponent(oauthToken),
        redirect: 'manual',
    });
    cookieParts.push(...(r3.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]));
    // R4+: Follow remaining redirects (LoginCallback → hub home)
    let nextUrl = r3.headers.get('location');
    if (!nextUrl)
        return null;
    if (!nextUrl.startsWith('http'))
        nextUrl = new URL(nextUrl, 'https://hub.infomentor.se').href;
    for (let i = 0; i < 5; i++) {
        const res = await fetch(nextUrl, {
            headers: { Cookie: cookieParts.join('; ') },
            redirect: 'manual',
        });
        cookieParts.push(...(res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]));
        if (res.status >= 300 && res.status < 400) {
            const loc = res.headers.get('location') || '';
            nextUrl = loc.startsWith('http') ? loc : new URL(loc, 'https://hub.infomentor.se').href;
        }
        else {
            break;
        }
    }
    return {
        cookies: cookieParts.join('; '),
        tokens: {
            access_token: accessToken,
            refresh_token: newRefreshToken,
            obtained_at: new Date().toISOString(),
        },
    };
}
/**
 * Get account info including the list of children (pupils).
 */
export async function getAccount(accessToken) {
    const res = await fetch('https://api-im.infomentor.se/NA1/account/Account', {
        headers: { Authorization: 'Bearer ' + accessToken },
    });
    if (!res.ok)
        return null;
    const data = (await res.json());
    return {
        userId: data.UserId,
        name: (data.FirstName + ' ' + data.LastName).trim(),
        pupils: (data.Pupils || []).map((p) => ({
            userRoleId: p.UserRoleId,
            firstName: p.FirstName.trim(),
            lastName: p.LastName.trim(),
        })),
    };
}
