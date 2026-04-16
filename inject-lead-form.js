// Inject the lead-capture form + Zapier-integrated JS + styles into personal-loans
// and credit card landing pages. Idempotent via a marker.

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const MARKER = 'lead-capture-v1';
const ZAPIER_URL = 'https://hooks.zapier.com/hooks/catch/12944636/ujtnxoz/';

const GUIDES = {
    'personal-loans': {
        h3: 'Not Ready to Apply Yet?',
        p: 'Get our free guide: <strong>"5 Ways to Get Approved for a Personal Loan (Even With Bad Credit)"</strong>'
    },
    'credit-cards': {
        h3: 'Not Sure Which Card to Pick?',
        p: 'Get our free guide: <strong>"How to Choose the Right Credit Card for Your Spending (2026 Edition)"</strong>'
    }
};

const LEAD_CSS = `
        /* ${MARKER} lead-capture styles */
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

function buildSection(leadType, campaign) {
    const g = GUIDES[leadType];
    return `
<!-- ${MARKER} -->
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
<script>
(function(){
  window.submitLead = async function(e) {
    e.preventDefault();
    var form = e.target;
    var btn = form.querySelector('button');
    var originalLabel = btn.innerHTML;
    btn.textContent = 'Sending...';
    btn.disabled = true;

    var data = {
      firstName: document.getElementById('firstName').value.trim(),
      email: document.getElementById('email').value.trim(),
      leadType: ${JSON.stringify(leadType)},
      referrerPage: window.location.pathname,
      campaign: ${JSON.stringify(campaign)},
      utmSource: 'organic',
      utmMedium: 'parasite',
      timestamp: new Date().toISOString()
    };

    try {
      // Direct Zapier webhook (works from static pages).
      await fetch(${JSON.stringify(ZAPIER_URL)}, {
        method: 'POST',
        body: JSON.stringify(data)
        // Note: no Content-Type header so the browser treats this as a simple
        // CORS request. Zapier accepts either form.
      });

      form.style.display = 'none';
      document.getElementById('formSuccess').style.display = 'block';

      if (window.gtag) {
        gtag('event', 'lead_capture', {
          lead_type: data.leadType,
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
</script>
`;
}

// ─────────── Process files ───────────

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.html'));
let updated = 0, skipped = 0, untouched = 0;

for (const file of files) {
    let leadType = null;
    if (file.startsWith('personal-loans-')) leadType = 'personal-loans';
    else if (file.startsWith('best-') && /credit-cards?/.test(file)) leadType = 'credit-cards';
    if (!leadType) continue;

    const full = path.join(DIR, file);
    let html = fs.readFileSync(full, 'utf8');

    if (html.includes(MARKER)) { skipped++; continue; }

    // Derive campaign from filename: drop extension, keep slug.
    const campaign = file.replace(/\.html$/, '');

    // Remove any prior `.guide-capture` block that was added in an earlier pass
    // (on personal-loans-for-bad-credit-2026.html). Done by matching the
    // section with the "Not Ready Yet? Get Our Free Guide" headline.
    html = html.replace(
        /<!--\s*11c\. EMAIL CAPTURE\s*-->\s*<section class="guide-capture">[\s\S]*?<\/section>\s*/,
        ''
    );

    // Inject CSS before </style>.
    const hasStyle = /<\/style>/.test(html);
    if (!hasStyle) { untouched++; continue; }
    html = html.replace('</style>', LEAD_CSS + '\n    </style>');

    // Insert the form before the FAQ section. Credit card pages use
    // <section id="faq" class="faq-section">; personal-loans uses
    // <section class="faq">.
    const faqRe = /(<section\s+(?:id="faq"[^>]*|class="faq"[^>]*)>)/;
    if (!faqRe.test(html)) { untouched++; continue; }
    html = html.replace(faqRe, buildSection(leadType, campaign) + '\n$1');

    fs.writeFileSync(full, html, 'utf8');
    updated++;
}

console.log(`Updated: ${updated}`);
console.log(`Skipped (already has marker): ${skipped}`);
console.log(`Untouched (no style/faq anchor): ${untouched}`);
