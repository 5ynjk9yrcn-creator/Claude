// The page behind the invite link in the family's text message.
// If OK Today is installed it hands the code straight to the app; if not, it
// shows the code in big friendly type with a link to get the app. Either way
// the parent never types anything they don't have to.

const APP_STORE_URL = "https://testflight.apple.com/"; // swapped for the App Store listing at launch

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );

Deno.serve((req) => {
  const url = new URL(req.url);
  const raw = (url.searchParams.get("c") ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const code = raw.slice(0, 8);
  const pretty = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
  const deepLink = `oktoday://parent-join?code=${encodeURIComponent(code)}`;

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>OK Today — your invitation</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Young+Serif&family=Karla:wght@400;700;800&display=swap" rel="stylesheet">
<style>
  :root { --sky:#EAF2F8; --skyDeep:#DCE9F4; --ink:#132C4B; --inkSoft:#5A7086; --sun:#F5B82E; --sunDeep:#E5A50A; --paper:#fff; --line:#DCE6EF; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:28px 20px 48px;
         background:linear-gradient(180deg,#F5F9FC,var(--skyDeep));
         font-family:Karla,-apple-system,system-ui,sans-serif; color:var(--ink); }
  .card { width:100%; max-width:420px; text-align:center; }
  .sun { width:104px; height:104px; margin:0 auto 18px; border-radius:50%;
         background:radial-gradient(circle at 38% 30%, #FFD966, var(--sun) 58%, var(--sunDeep));
         box-shadow:0 12px 26px rgba(180,124,9,.32); }
  h1 { font-family:'Young Serif',Georgia,serif; font-size:34px; line-height:1.15; margin:0 0 10px; }
  p { font-size:18px; line-height:1.5; color:var(--inkSoft); margin:0 0 22px; }
  .codebox { background:var(--paper); border:2px solid var(--sun); border-radius:22px;
             padding:20px 16px; margin:0 0 22px; box-shadow:0 10px 26px rgba(18,49,82,.09); }
  .codelabel { font-size:11px; letter-spacing:1.6px; font-weight:800; color:var(--inkSoft); }
  .code { font-size:38px; font-weight:800; letter-spacing:5px; margin-top:6px; }
  a.btn { display:block; text-decoration:none; border-radius:18px; padding:18px 20px;
          font-weight:700; font-size:18px; margin-bottom:12px; }
  .primary { background:var(--sun); color:#4A3503; box-shadow:0 10px 24px rgba(229,165,10,.32); }
  .secondary { background:var(--paper); color:var(--ink); border:1.5px solid var(--line); }
  .small { font-size:14px; color:var(--inkSoft); margin-top:18px; }
  @media (prefers-color-scheme: dark) {
    body { background:linear-gradient(180deg,#16283C,#0F1F30); color:#EAF2F8; }
    h1 { color:#EAF2F8; } p, .small { color:#A9BDCE; }
    .codebox { background:#1B3247; border-color:var(--sun); }
    .code { color:#FFE9B0; } .secondary { background:#1B3247; color:#EAF2F8; border-color:#2C4864; }
  }
</style></head>
<body>
  <div class="card">
    <div class="sun"></div>
    <h1>You've been invited<br>to OK Today</h1>
    <p>One tap each morning tells your family you're OK.</p>
    ${
      code.length === 8
        ? `<div class="codebox"><div class="codelabel">YOUR CODE</div><div class="code">${esc(pretty)}</div></div>
    <a class="btn primary" id="open" href="${esc(deepLink)}">Open in OK Today</a>
    <a class="btn secondary" href="${APP_STORE_URL}">Get the app first</a>
    <p class="small">Already installed? The button above sets everything up. Otherwise get the app, choose “I'm checking in”, and enter the code above.</p>`
        : `<p class="small">This link is missing its code. Ask your family to send the invite again from Settings → Invite.</p>`
    }
  </div>
  <script>
    // Try to hand off to the app straight away; if nothing happens, the
    // buttons above are still there.
    (function () {
      var code = ${JSON.stringify(code)};
      if (code.length === 8) {
        setTimeout(function () { window.location.href = ${JSON.stringify(deepLink)}; }, 350);
      }
    })();
  </script>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
});
