import { createServer } from "node:http";

// A stand-in for a JAWA site: plain pages with the links, redirects and
// forms the desktop shell has to handle. It records every request so tests
// can check exactly what reached the server.

const page = (title, body = "") => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body><h1 id="where">${title}</h1>${body}</body></html>`;

const HOME_LINKS = `
<a id="own" href="/second">Own page</a>
<a id="external" href="https://example.org/menu">External site</a>
<a id="file" href="file:///etc/hosts">Local file</a>
<a id="mail" href="mailto:hello@example.org">Email</a>
<a id="popup-own" href="/second" target="_blank">Own page, new window</a>
<a id="popup-external" href="https://qz.io/download/" target="_blank" rel="noopener noreferrer">External, new window</a>
<a id="browser" href="/desktop/sign-in/browser/fictional-request" target="jawa-browser">Sign in with your browser</a>
<a id="redirect" href="/redirect-out">Redirect elsewhere</a>
<a id="other-app" href="OTHER_APP/">Other JAWA app</a>`;

export async function startFakeSite({ title = "Fake JAWA site", port = 0, otherOrigin = "https://food.example.test" } = {}) {
  const requests = [];
  let identityOrigin = null;

  const handler = async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const url = new URL(request.url, "http://fake.invalid");
    const record = { method: request.method, path: url.pathname, query: url.search, headers: request.headers, body: Buffer.concat(chunks).toString() };
    requests.push(record);
    const html = (status, body, headers = {}) => {
      response.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...headers });
      response.end(body);
    };
    const redirect = (location, status = 302) => { response.writeHead(status, { Location: location }); response.end(); };

    switch (`${request.method} ${url.pathname}`) {
      case "GET /":
      case "GET /businesses":
        return html(200, page(title, HOME_LINKS.replace("OTHER_APP", otherOrigin)));
      case "GET /second":
        return html(200, page("Second page"));
      case "GET /post-then-redirect":
        return html(200, page("Form", `<form id="form" method="post" action="/echo-redirect"><button id="send">Send</button></form>`));
      case "POST /echo-redirect":
        return redirect("/headers", 303);
      case "GET /script-opens-browser":
        return html(200, page("Waiting", `<a id="again" href="/desktop/sign-in/browser/fictional-request" target="jawa-browser">Again</a><script>window.open("/desktop/sign-in/browser/fictional-request", "jawa-browser", "noopener")</script>`));
      // A service worker that fetches page loads itself, as MENU's does.
      case "GET /with-worker":
        return html(200, page("Worker page", `<a id="through-worker" href="/headers">Headers</a><script>navigator.serviceWorker.register("/worker.js")</script>`));
      case "GET /worker.js":
        response.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-store" });
        return response.end(`self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => { if (event.request.mode === "navigate") event.respondWith(fetch(event.request)); });`);
      case "GET /headers":
        return html(200, page("Headers", `<pre id="agent">${request.headers["user-agent"]}</pre>`));
      case "GET /redirect-out":
        return redirect("https://example.org/after-redirect");
      case "GET /set-binding":
        return html(200, page("Binding set"), { "Set-Cookie": "desktop_binding=window-secret; Path=/; HttpOnly; SameSite=Lax" });
      case "POST /desktop/sign-in/complete":
        return redirect("/signed-in", 303);
      case "GET /signed-in":
        return html(200, page("Signed in"));
      case "GET /permissions":
        return html(200, page("Permissions", `<script>
          window.results = (async () => ({
            notifications: await Notification.requestPermission(),
            geolocation: await new Promise((resolve) => navigator.geolocation.getCurrentPosition(() => resolve("granted"), (error) => resolve(error.code === 1 ? "denied" : "error:" + error.code))),
            camera: await navigator.mediaDevices.getUserMedia({ video: true }).then(() => "granted", (error) => error.name),
            states: Object.fromEntries(await Promise.all([ "camera", "microphone", "geolocation", "notifications" ].map(async (name) => [ name, (await navigator.permissions.query({ name })).state ]))),
            node: typeof require + "/" + typeof process + "/" + typeof module,
          }))();
        </script>`));
      case "GET /webview":
        return html(200, page("Webview", `<webview id="embedded" src="https://example.org/"></webview>`));
      case "GET /iframe":
        return html(200, page("Frame", `<iframe id="frame" src="https://example.org/framed"></iframe>`));
      // A SITE-style sign-in that round-trips through the JAWA ID origin.
      case "GET /sign-in":
        return redirect(`${identityOrigin}/oauth/authorize?return_to=${encodeURIComponent(`${origin()}/auth/callback`)}`);
      case "GET /oauth/authorize":
        return redirect(url.searchParams.get("return_to"));
      case "GET /auth/callback":
        return html(200, page("Signed in through JAWA ID"));
      default:
        return html(404, page("Not found"));
    }
  };

  let server = createServer(handler);
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  const boundPort = server.address().port;
  const origin = () => `http://127.0.0.1:${boundPort}`;

  return {
    get origin() { return origin(); },
    requests,
    useIdentity(identity) { identityOrigin = identity; },
    async stop() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
    async restart() {
      server = createServer(handler);
      await new Promise((resolve) => server.listen(boundPort, "127.0.0.1", resolve));
    },
  };
}
