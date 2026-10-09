// Fixed-origin gateway for networks that cannot reach Netlify's CDN.
const upstreamOrigin = "https://acme-jobs-app.netlify.app";

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const target = new URL(incoming.pathname + incoming.search, upstreamOrigin);
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("x-forwarded-host");
    headers.delete("x-forwarded-proto");
    // Only translate a verified same-origin browser request. Foreign origins
    // remain foreign so the application's CSRF checks still reject them.
    if (headers.get("origin") === incoming.origin) {
      headers.set("origin", upstreamOrigin);
    }
    const clientIp = request.headers.get("cf-connecting-ip");
    if (clientIp) headers.set("x-forwarded-for", clientIp);
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });
    const response = new Response(upstream.body, upstream);
    const location = response.headers.get("location");
    if (location) {
      const redirect = new URL(location, upstreamOrigin);
      if (redirect.origin === upstreamOrigin) {
        response.headers.set("location", incoming.origin + redirect.pathname + redirect.search + redirect.hash);
      }
    }
    return response;
  },
};
