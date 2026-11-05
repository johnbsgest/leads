// Builds v2.html (the "premium" Leads form) from index.html.
// Same fields, ids and script, so it submits exactly like the current form; only the
// markup order, wording around the fields and the styling change.
//   node build-v2.js      -> writes v2.html next to index.html
// Re-run after changing index.html so v2 picks up the change.
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, 'index.html');
const OUT = path.join(__dirname, 'v2.html');
let s = fs.readFileSync(SRC, 'utf8');

// ---- pull the existing blocks out of the current form ----------------------------
function divAt(str, start) {
  const re = /<div\b|<\/div>/g; re.lastIndex = start; let depth = 0, m;
  while ((m = re.exec(str))) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return str.slice(start, m.index + 6);
  }
  throw new Error('unbalanced div at ' + start);
}
function block(marker, opener) {
  const at = s.indexOf(marker);
  if (at < 0) throw new Error('marker not found: ' + marker);
  const start = s.lastIndexOf(opener, at);
  if (start < 0) throw new Error('opener not found for ' + marker);
  return divAt(s, start).trim();
}
const F = '<div class="field';
// v2 asks for first and last name separately (the server needs both; one "Full Name"
// box let a single-word name through and the server then rejected the request).
const name = `<div class="grid grid-2">
            <div class="field">
              <label class="label" for="firstName">First Name <span class="req">*</span></label>
              <input id="firstName" name="firstName" type="text" autocomplete="given-name" required />
              <div class="error" data-error-for="firstName">First name is required.</div>
            </div>
            <div class="field">
              <label class="label" for="lastName">Last Name <span class="req">*</span></label>
              <input id="lastName" name="lastName" type="text" autocomplete="family-name" required />
              <div class="error" data-error-for="lastName">Last name is required.</div>
            </div>
          </div>`;
const address  = block('id="addressSearch"', F);
const street   = block('id="streetViewWrap"', '<div id="streetViewWrap"');
const phoneMail= block('for="phone"', '<div class="grid grid-2">');
const contact  = block('How should we contact you?', F);
const services = block('<div class="label">Services', F);
const covers   = block('id="coversQuestion"', '<div id="coversQuestion"');
const details  = block('for="details"', F);
const photos   = block('id="photoThumbs"', F);
const honeypot = block('for="website"', '<div class="hidden"');
const actions  = block('id="submitBtn"', '<div class="actions">')
  .replace('>Submit</button>', '>Send my request <span aria-hidden="true">→</span></button>');

// ---- new layout ----------------------------------------------------------------
const step = (n, title, sub, body) => `
          <section class="v2-step">
            <div class="v2-step-head"><span class="v2-num">${n}</span><div><h3>${title}</h3><p>${sub}</p></div></div>
            <div class="v2-fields">
${body}
            </div>
          </section>`;

const markup = `  <div class="v2-shell">
    <header class="v2-head">
      <div class="v2-eyebrow">Bethlehem Seamless Gutters</div>
      <h1>Request a free estimate</h1>
      <p>Takes about a minute. We'll get back to you during business hours.</p>
    </header>

    <div class="v2-body">
      <form id="intakeForm" class="intake-form" novalidate>
${step(1, 'How can we help?', 'Pick everything that applies.', [services, covers].join('\n'))}
${step(2, 'Your home', 'So we know where and what we’re looking at.', [address, street, details, photos].join('\n'))}
${step(3, 'How to reach you', 'We’ll use the method you pick.', [name, phoneMail, contact].join('\n'))}

        ${honeypot}

        ${actions}
      </form>

      <aside class="v2-side">
        <h3>What happens next</h3>
        <ol>
          <li><b>We review your request</b><span>Photos help us come prepared.</span></li>
          <li><b>We reach out</b><span>By call, text or email, whichever you picked, during business hours.</span></li>
          <li><b>Free estimate</b><span>We look at your gutters in person and explain your options.</span></li>
        </ol>
        <div class="v2-trust">
          <div class="v2-medal" aria-hidden="true"><b>5×</b></div>
          <span>Nextdoor Neighborhood Favorite, 2021–2025</span>
        </div>
        <div class="v2-call">Rather talk? <a href="tel:+15183013299">(518) 301-3299</a><br><small>Mon–Fri 9–5, Sat 9–12</small></div>
      </aside>
    </div>
  </div>
`;

const wrapStart = s.indexOf('  <div class="intake-wrap">');
const wrapEnd = s.indexOf('  <div id="successModal"');
if (wrapStart < 0 || wrapEnd < 0) throw new Error('wrap markers');
s = s.slice(0, wrapStart) + markup + '\n' + s.slice(wrapEnd);
// Script: validate and send the separate first/last name fields.
const swap = (a, b) => { if (!s.includes(a)) throw new Error('script changed: ' + a); s = s.replace(a, b); };
swap('const fieldsToValidate = ["fullName", "phone", "email"];', 'const fieldsToValidate = ["firstName", "lastName", "phone", "email"];');
swap('["fullName", "phone", "contactMethod"].includes(name)', '["firstName", "lastName", "phone", "contactMethod"].includes(name)');
swap('const nameParts = form.fullName.value.trim().split(/\\s+/);', '// First and last name are separate fields in v2.');
swap('const firstName = nameParts[0] || "";', 'const firstName = form.firstName.value.trim();');
swap('const lastName  = nameParts.slice(1).join(" ") || "";', 'const lastName  = form.lastName.value.trim();');
s = s.replace('submitBtn.textContent = "Submit";', 'submitBtn.innerHTML = \'Send my request <span aria-hidden="true">→</span>\';');
s = s.replace('<title>Bethlehem Seamless Gutters - Request Estimate</title>',
  '<title>Bethlehem Seamless Gutters - Request Estimate</title>\n  <link rel="preconnect" href="https://fonts.googleapis.com">\n  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">');

// ---- v2 styles (added after the original ones, so they win) ----------------------
const css = `
    /* ================= v2 premium look ================= */
    :root { --accent: #ff990a; --accent-dark: #e08300; --ink: #111; --line: #e6e6e6; --radius: 12px; }
    body { font-family: Poppins, system-ui, sans-serif; background: #f4f4f2; color: var(--ink); }
    input, textarea, select, button { font-family: inherit; }
    .v2-shell { max-width: 1080px; margin: 0 auto; padding: 16px; }
    .v2-head { background: #111; color: #fff; border-radius: 18px 18px 0 0; padding: 28px 28px 26px; position: relative; overflow: hidden; }
    .v2-head::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: var(--accent); }
    .v2-eyebrow { color: var(--accent); font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
    .v2-head h1 { margin: 6px 0 6px; font-size: clamp(26px, 4vw, 36px); font-weight: 800; letter-spacing: -.02em; line-height: 1.1; }
    .v2-head p { margin: 0; color: #bdbdbd; font-size: 15px; }
    .v2-body { background: #fff; border-radius: 0 0 18px 18px; box-shadow: 0 18px 40px rgba(0,0,0,.08); padding: 8px 28px 28px; display: grid; gap: 32px; }
    .v2-step { padding: 22px 0 6px; border-bottom: 1px solid var(--line); }
    .v2-step-head { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 16px; }
    .v2-num { flex: 0 0 34px; height: 34px; border-radius: 50%; background: #111; color: var(--accent); font-weight: 800; display: grid; place-items: center; font-size: 15px; }
    .v2-step-head h3 { margin: 2px 0 2px; font-size: 19px; font-weight: 700; }
    .v2-step-head p { margin: 0; color: var(--muted); font-size: 14px; }
    .v2-fields { display: grid; gap: 16px; }
    .label { font-size: 14px; font-weight: 600; }
    input, textarea, select { background: #fafafa; border: 1.5px solid var(--line); border-radius: var(--radius); padding: 14px 16px; font-size: 16px; }
    input:focus, textarea:focus, select:focus { background: #fff; border-color: var(--accent); box-shadow: 0 0 0 4px rgba(255,153,10,.18); }
    textarea { min-height: 110px; }
    .service-card, .contact-card, .covers-card { position: relative; border: 1.5px solid var(--line); border-radius: 14px; background: #fff; color: #333; font-weight: 600; padding: 18px 10px; transition: border-color .15s, background .15s, transform .1s; }
    .service-card:active, .contact-card:active, .covers-card:active { transform: scale(.98); }
    .service-card.selected, .contact-card.selected, .covers-card.selected { border-color: var(--accent); background: #fff6e8; color: #111; box-shadow: none; }
    .service-card.selected::after, .contact-card.selected::after, .covers-card.selected::after {
      content: '✓'; position: absolute; top: 8px; right: 8px; width: 20px; height: 20px; border-radius: 50%;
      background: var(--accent); color: #111; font-size: 12px; font-weight: 800; display: grid; place-items: center; }
    .service-card--other.selected::after { top: 14px; }
    @media (hover: hover) and (pointer: fine) {
      .service-card:hover, .contact-card:hover, .covers-card:hover { border-color: var(--accent); color: #111; }
    }
    /* The icon images have a white square behind them; multiply makes the white take the card color. */
    .service-icon { width: 30px; height: 30px; background: transparent; mix-blend-mode: multiply; }
    .photo-add { border: 1.5px dashed #cfcfcf; border-radius: 14px; background: #fafafa; }
    .actions { margin-top: 4px; width: auto !important; margin-left: 0 !important; }
    .btn { background: var(--accent); color: #111; border-radius: 999px; font-size: 18px; font-weight: 700; padding: 17px 22px; box-shadow: 0 8px 20px rgba(255,153,10,.35); }
    .btn:hover { background: var(--accent-dark); }
    .modal-close { background: var(--accent); color: #111; border-radius: 999px; }
    .modal-box { border-radius: 18px; font-family: Poppins, system-ui, sans-serif; }

    .v2-side { background: #111; color: #ddd; border-radius: 16px; padding: 24px; align-self: start; }
    .v2-side h3 { color: #fff; margin: 0 0 14px; font-size: 18px; }
    .v2-side ol { list-style: none; counter-reset: s; margin: 0; padding: 0; display: grid; gap: 14px; }
    .v2-side li { counter-increment: s; display: grid; grid-template-columns: 28px 1fr; column-gap: 12px; }
    .v2-side li::before { content: counter(s); grid-row: span 2; width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid var(--accent); color: var(--accent); font-weight: 700; font-size: 13px; display: grid; place-items: center; }
    .v2-side li b { color: #fff; font-size: 15px; }
    .v2-side li span { color: #a8a8a8; font-size: 13.5px; }
    .v2-trust { display: flex; gap: 14px; align-items: center; margin-top: 20px; padding-top: 18px; border-top: 1px solid #2a2a2a; }
    .v2-trust > span { font-size: 13.5px; }
    /* Award medal: orange disc with a dark inner ring. */
    .v2-medal { flex: 0 0 72px; height: 72px; border-radius: 50%; display: grid; place-content: center; justify-items: center; text-align: center;
      background: radial-gradient(circle at 35% 30%, #ffc266, #ff990a 55%, #d97a00);
      box-shadow: inset 0 0 0 4px #111, inset 0 0 0 6px rgba(255,255,255,.35), 0 6px 18px rgba(255,153,10,.35); color: #111; }
    .v2-medal b { font-size: 26px; font-weight: 800; line-height: 1; letter-spacing: -.02em; }
    .v2-call { margin-top: 16px; font-size: 14px; }
    .v2-call a { color: var(--accent); font-weight: 700; text-decoration: none; }
    .v2-call small { color: #8a8a8a; }

    /* Wide screens: steps on the left, "what happens next" pinned on the right. */
    @media (min-width: 860px) {
      .v2-body { grid-template-columns: 1fr 300px; padding: 8px 32px 32px; gap: 40px; }
      .v2-side { position: sticky; top: 16px; margin-top: 24px; }
      .v2-fields .grid-2 { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 640px) {
      .v2-shell { padding: 0; }
      .v2-head { border-radius: 0; padding: 24px 18px 22px; }
      .v2-body { border-radius: 0; padding: 4px 18px 24px; }
    }

    /* Inside the website's frame: no page background or outer padding, the site supplies those. */
    html.embedded body { background: transparent; }
    html.embedded .v2-shell { padding: 0; max-width: none; }
    html.embedded .v2-body { box-shadow: none; border: 1px solid #e6e6e6; border-top: 0; }
    @media (max-width: 640px) {
      html.embedded .v2-head { border-radius: 16px 16px 0 0; }
      html.embedded .v2-body { border-radius: 0 0 16px 16px; }
    }
`;
const styleEnd = s.indexOf('\n  </style>');
s = s.slice(0, styleEnd) + '\n' + css + s.slice(styleEnd + 1);
// Mark the page as embedded before it paints, so there's no flash of the standalone look.
s = s.replace('  <link rel="preconnect" href="https://fonts.googleapis.com">',
  '  <script>if (window.parent !== window) document.documentElement.classList.add("embedded");</script>\n  <link rel="preconnect" href="https://fonts.googleapis.com">');

fs.writeFileSync(OUT, s);
console.log('wrote', OUT);
