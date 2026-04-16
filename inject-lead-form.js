// Inject the segment-aware lead-capture form (+ URL parser + styles) into all
// landing pages. Marker is bumped to v2 -- the script replaces any v1 block in
// place and skips files already at v2.
//
// Segments captured (client-side, mirrored server-side in api/capture-lead.js):
//   leadType, specificNeed, profession, city, utm* -- all derived from the
//   page URL so every submission carries the full taxonomy.

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const MARKER_V1 = 'lead-capture-v1';
const MARKER_V2 = 'lead-capture-v2';
const ZAPIER_URL = 'https://hooks.zapier.com/hooks/catch/12944636/ujtnxoz/';

const GUIDES = {
    'personal-loans': {
        h3: 'Not Ready to Apply Yet?',
        p: 'Get our free guide: <strong>"5 Ways to Get Approved for a Personal Loan (Even With Bad Credit)"</strong>'
    },
    'credit-cards': {
        h3: 'Not Sure Which Card to Pick?',
        p: 'Get our free guide: <strong>"How to Choose the Right Credit Card for Your Spending (2026 Edition)"</strong>'
    },
    'business-loans': {
        h3: 'Need Business Funding?',
        p: 'Get our free guide: <strong>"Small Business Funding Options That Actually Work in 2026"</strong>'
    }
};

const LEAD_CSS = `
        /* ${MARKER_V2} lead-capture styles */
        .lead-capture-section { background: #f0faf5; border: 1px solid #c3e6d5; border-radius: 12px; padding: 32px; margin: 48px auto; max-width: 680px; }
        .lead-capture-box h3 { font-size: 20px; font-weight: 700; color: #111111; margin: 0 0 8px; font-family: 'Inter', sans-serif; }
        .lead-capture-box p { color: #444444; font-size: 15px; margin: 0 0 20px; line-height: 1.6; }
        .lead-capture-box .form-row { display: flex; gap: 12px; margin-bottom: 12px; }
        .lead-capture-box .form-row input { flex: 1; padding: 12px 16px; border: 1px solid #e2e2e2; border-radius: 8px; font-size: 15px; font-family: 'Inter', sans-serif; background: #ffffff; color: #111111; }
        .lead-capture-box .form-row input:focus { outline: none; border-color: #008254; box-shadow: 0 0 0 3px rgba(0,130,84,0.12); }
        .lead-capture-box .lead-btn { width: 100%; background: #008254; color: #ffffff; border: none; padding: 14px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; transition: background 0.2s; }
        .lead-capture-box .lead-btn:hover { background: #006b44; }
        .lead-capture-box .lead-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .lead-capture-box .privacy-note { font-size: 12px; color: #717171; margin: 10px 0 0; text-align: center; }
        .lead-capture-box #formSuccess p { color: #008254; font-weight: 600; text-align: center; font-size: 16px; margin: 0; }
        .lead-capture-box #formError p { color: #c0392b; font-weight: 600; text-align: center; font-size: 14px; margin: 0; }
        @media (max-width: 640px) { .lead-capture-box .form-row { flex-direction: column; } .lead-capture-section { margin: 32px 16px; padding: 24px; } }
`;

// Client-side URL parser + submit handler. Serialised into a string so the
// inline <script> body is identical on every page.
const FORM_JS = `
(function(){
  function parsePageUrl(pathname) {
    var slug = (pathname || '').replace(/^\\/+|\\/+$/g, '').replace(/\\.html$/, '').split(/[?#]/)[0].toLowerCase();
    var yearMatch = slug.match(/^(.+)-(20\\d{2})$/);
    var core = yearMatch ? yearMatch[1] : slug;
    var m;
    if ((m = core.match(/^personal-loans-for-(.+)$/))) return { leadType: 'personal-loans', specificNeed: m[1], profession: '', city: '' };
    if ((m = core.match(/^best-credit-cards-for-(.+)$/))) return { leadType: 'credit-cards', profession: m[1], specificNeed: '', city: '' };
    if (core === 'best-cash-back-credit-cards') return { leadType: 'credit-cards', specificNeed: 'cash-back', profession: '', city: '' };
    if ((m = core.match(/^best-credit-cards-(.+)$/))) return { leadType: 'credit-cards', specificNeed: m[1], profession: '', city: '' };
    if ((m = core.match(/^business-loans-(.+)-([a-z]{2})$/))) return { leadType: 'business-loans', city: m[1], specificNeed: '', profession: '' };
    if (/^business-loans/.test(core)) return { leadType: 'business-loans', specificNeed: '', profession: '', city: '' };
    if (/^personal-loans/.test(core)) return { leadType: 'personal-loans', specificNeed: '', profession: '', city: '' };
    if (/^best-/.test(core)) return { leadType: 'credit-cards', specificNeed: '', profession: '', city: '' };
    return { leadType: 'personal-loans', specificNeed: '', profession: '', city: '' };
  }

  function getUtm(name) {
    try {
      var v = new URLSearchParams(window.location.search).get(name);
      return v || '';
    } catch (e) { return ''; }
  }

  window.submitLead = async function(e) {
    e.preventDefault();
    var form = e.target;
    var btn = form.querySelector('button');
    var originalLabel = btn.innerHTML;
    btn.textContent = 'Sending...';
    btn.disabled = true;

    var seg = parsePageUrl(window.location.pathname);
    var data = {
      firstName: document.getElementById('firstName').value.trim(),
      email: document.getElementById('email').value.trim(),
      leadType: seg.leadType,
      specificNeed: seg.specificNeed,
      profession: seg.profession,
      city: seg.city,
      referrerPage: window.location.pathname,
      utmSource: getUtm('utm_source') || 'organic',
      utmMedium: getUtm('utm_medium') || 'parasite',
      utmCampaign: getUtm('utm_campaign') || (window.location.pathname.replace(/^\\/+|\\/+$/g, '').replace(/\\.html$/, '')),
      timestamp: new Date().toISOString()
    };

    try {
      await fetch(${JSON.stringify(ZAPIER_URL)}, {
        method: 'POST',
        body: JSON.stringify(data)
      });

      form.style.display = 'none';
      document.getElementById('formSuccess').style.display = 'block';

      if (window.gtag) {
        gtag('event', 'lead_capture', {
          lead_type: data.leadType,
          specific_need: data.specificNeed,
          profession: data.profession,
          city: data.city,
          page: window.location.pathname
        });
      }
    } catch (err) {
      btn.innerHTML = originalLabel;
      btn.disabled = false;
      document.getElementById('formError').style.display = 'block';
    }
  };
})();
`;

function buildSection(leadType) {
    const g = GUIDES[leadType];
    return `
<!-- ${MARKER_V2} -->
<div class="lead-capture-section">
  <div class="lead-capture-box">
    <h3>${g.h3}</h3>
    <p>${g.p}</p>
    <form id="leadForm" onsubmit="submitLead(event)">
      <div class="form-row">
        <input type="text" id="firstName" placeholder="First Name" required autocomplete="given-name">
        <input type="email" id="email" placeholder="Email Address" required autocomplete="email">
      </div>
      <button type="submit" class="lead-btn">Send Me the Free Guide &rarr;</button>
    </form>
    <p class="privacy-note">We respect your privacy. Unsubscribe anytime. No spam ever.</p>
    <div id="formSuccess" style="display:none;margin-top:12px;">
      <p>&#10003; Check your email! Your guide is on its way.</p>
    </div>
    <div id="formError" style="display:none;margin-top:12px;">
      <p>Something went wrong. Please try again.</p>
    </div>
  </div>
</div>
<script>${FORM_JS}</script>
`;
}

// Regex that matches either the v1 or v2 injected block (form + following
// <script> up through </script>). Used to swap v1 in place.
const EXISTING_BLOCK_RE = new RegExp(
    `<!--\\s*${MARKER_V1}\\s*-->[\\s\\S]*?<\\/script>\\s*`,
    'g'
);
const V2_BLOCK_RE = new RegExp(
    `<!--\\s*${MARKER_V2}\\s*-->`
);

// ─────────── Process files ───────────

function leadTypeFor(file) {
    if (file.startsWith('personal-loans-')) return 'personal-loans';
    if (file.startsWith('business-loans-')) return 'business-loans';
    if (file.startsWith('best-') && /credit-cards?/.test(file)) return 'credit-cards';
    return null;
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.html'));
let updated = 0, upgraded = 0, skipped = 0, untouched = 0;

for (const file of files) {
    const leadType = leadTypeFor(file);
    if (!leadType) continue;

    const full = path.join(DIR, file);
    let html = fs.readFileSync(full, 'utf8');

    // Already at v2? skip.
    if (V2_BLOCK_RE.test(html)) { skipped++; continue; }

    const newBlock = buildSection(leadType);

    if (EXISTING_BLOCK_RE.test(html)) {
        // Replace the v1 block in place with v2. CSS stays (harmless aside
        // from the marker comment in the v2 CSS block which we also add).
        html = html.replace(EXISTING_BLOCK_RE, newBlock + '\n');
        upgraded++;
    } else {
        // Fresh insert: css before </style>, section before FAQ.
        const hasStyle = /<\/style>/.test(html);
        if (!hasStyle) { untouched++; continue; }
        html = html.replace('</style>', LEAD_CSS + '\n    </style>');

        const faqRe = /(<section\b[^>]*(?:id="faq"|class="[^"]*faq[^"]*")[^>]*>)/;
        if (!faqRe.test(html)) { untouched++; continue; }
        html = html.replace(faqRe, newBlock + '\n$1');
        updated++;
    }

    fs.writeFileSync(full, html, 'utf8');
}

console.log(`Fresh inserts:   ${updated}`);
console.log(`Upgraded v1->v2: ${upgraded}`);
console.log(`Skipped (v2):    ${skipped}`);
console.log(`Untouched:       ${untouched}`);
