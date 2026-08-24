/**
 * InfoMentor Hub API client.
 *
 * All endpoints require web session cookies obtained via the SSO bridge.
 * Important: some endpoints require POST (not GET) or they return error pages.
 */
const HUB = 'https://hub.infomentor.se';
function stripHtml(html) {
    return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
async function hubFetch(cookies, path, method = 'GET', body) {
    const headers = {
        Cookie: cookies,
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
    };
    const res = await fetch(HUB + path, {
        method,
        headers,
        body: body || undefined,
        redirect: 'manual',
    });
    if (res.status !== 200)
        return { __error: res.status };
    const text = await res.text();
    try {
        return JSON.parse(text);
    }
    catch {
        return { __error: text.slice(0, 100) };
    }
}
export async function switchChild(cookies, switchId) {
    await fetch(`${HUB}/Account/PupilSwitcher/SwitchPupil/${switchId}`, {
        headers: { Cookie: cookies },
        redirect: 'follow',
    });
}
export async function getNews(cookies) {
    const resp = (await hubFetch(cookies, '/Communication/News/GetNewsList'));
    return (resp?.items || []).map((item) => ({
        ...item,
        content: stripHtml(item.content || ''),
    }));
}
export async function getNotifications(cookies) {
    // Must be POST — GET returns an error page
    const resp = (await hubFetch(cookies, '/NotificationApp/NotificationApp/appData', 'POST'));
    return resp?.notifications || [];
}
export async function getCalendarEntries(cookies, startDate, endDate) {
    const resp = await hubFetch(cookies, `/calendarv2/calendarv2/getentries?startDate=${startDate}&endDate=${endDate}`);
    return Array.isArray(resp) ? resp : [];
}
export async function getAttachments(cookies, entryId) {
    const resp = await hubFetch(cookies, '/calendarv2/calendarv2/getattachments', 'POST', JSON.stringify({ id: String(entryId) }));
    return Array.isArray(resp) ? resp : [];
}
export async function downloadAttachment(cookies, urlPath) {
    const res = await fetch(HUB + urlPath, {
        headers: { Cookie: cookies },
        redirect: 'follow',
    });
    return Buffer.from(await res.arrayBuffer());
}
