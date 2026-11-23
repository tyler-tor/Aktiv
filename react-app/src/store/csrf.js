// Small wrapper around fetch() that adds the CSRF header to write requests.
//
// Flask sets a `csrf_token` cookie on every response. For POST/PUT/PATCH/DELETE
// the server requires the same token in the `X-CSRFToken` header. Another
// website can make your browser send the cookie, but it cannot read it, so it
// cannot copy it into the header - that is what blocks cross-site requests.

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS', 'TRACE'];

export const getCsrfToken = () => {
    const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
};

export const csrfFetch = (url, options = {}) => {
    const method = (options.method || 'GET').toUpperCase();
    if (SAFE_METHODS.includes(method)) {
        return fetch(url, options);
    }
    const headers = new Headers(options.headers || {});
    headers.set('X-CSRFToken', getCsrfToken());
    return fetch(url, { ...options, headers });
};

export default csrfFetch;
