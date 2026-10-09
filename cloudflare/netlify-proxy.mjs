// Preserve old bookmarks after moving the app from Netlify to Vercel.
const appOrigin = "https://acme-jobs-vercel.vercel.app";

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    return Response.redirect(new URL(incoming.pathname + incoming.search, appOrigin).toString(), 308);
  },
};
