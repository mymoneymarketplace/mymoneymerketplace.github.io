// Lead capture serverless handler with segment-aware email routing.
//
// Note: mymoneymarketplace.github.io is GitHub Pages (static only), so this
// function must run on a separate host. Drop it into Vercel, Netlify Functions,
// or Cloudflare Workers -- the handler signature below is Vercel/Netlify style
// (req/res). For Cloudflare, wrap the body in a `fetch` handler.
//
// Env vars required:
//   ZAPIER_WEBHOOK_URL   - webhook endpoint (Zapier catches it, fans out to GHL)
//   RESEND_API_KEY       - https://resend.com API key
//   FROM_EMAIL           - e.g. hello@mymoneymarketplace.com (must be a verified sender)
//
// Form pages call this endpoint. If it is unreachable, the page-side JS falls
// back to hitting the Zapier webhook directly with the full segmented payload
// (Zapier can also send the welcome email via its own Resend step -- see GHL
// notes at the bottom).
//
// GHL AUTOMATION TO CREATE IN GOHIGHLEVEL:
// 1. Create workflow trigger: Webhook received
// 2. Tag contact with both leadType AND segment:
//    - leadType: "personal-loans" | "credit-cards" | "business-loans"
//    - specificNeed: "bad-credit" | "debt-consolidation" | "home-improvement" | "cash-back" | ...
//    - profession: "nurses" | "doctors" | "teachers" | ...
//    - city: "miami" | "austin" | "chicago" | ...
// 3. Add to appropriate pipeline stage based on leadType
// 4. Start email sequence based on the FINEST-grain segment tag available:
//    - personal-loans + bad-credit tag -> Bad Credit Nurture
//    - personal-loans + debt-consolidation tag -> Consolidation Nurture
//    - credit-cards + nurses tag -> Healthcare Workers Nurture
//    - credit-cards + cash-back tag -> Cash Back Nurture
//    - business-loans + city tag -> Local Business Nurture
//    - fallback: leadType-only nurture
// 5. Assign to pipeline: MMM Leads
// 6. SMS follow up after 24 hours (optional)

const fs = require('fs');
const path = require('path');

// ─────────── Template cache ───────────
// Load email templates once at cold start.

const TEMPLATE_DIR = path.join(__dirname, '..', 'email-templates');
let templates = null;

function loadTemplates() {
    if (templates) return templates;
    templates = {};
    const files = fs.readdirSync(TEMPLATE_DIR).filter(f => f.endsWith('.html'));
    for (const f of files) {
        templates[f.replace('.html', '')] = fs.readFileSync(path.join(TEMPLATE_DIR, f), 'utf8');
    }
    return templates;
}

// ─────────── URL parser ───────────
// Mirrors the client-side parser so the backend can re-derive segments if
// referrerPage arrives but discrete fields do not.

function parsePageUrl(pathname) {
    if (!pathname) return {};
    const slug = pathname.replace(/^\/+|\/+$/g, '').replace(/\.html$/, '').split(/[?#]/)[0].toLowerCase();
    const yearMatch = slug.match(/^(.+)-(20\d{2})$/);
    const core = yearMatch ? yearMatch[1] : slug;
    const out = {};

    let m;
    if ((m = core.match(/^personal-loans-for-(.+)$/))) {
        return { leadType: 'personal-loans', specificNeed: m[1] };
    }
    if ((m = core.match(/^best-credit-cards-for-(.+)$/))) {
        return { leadType: 'credit-cards', profession: m[1] };
    }
    if (core === 'best-cash-back-credit-cards') {
        return { leadType: 'credit-cards', specificNeed: 'cash-back' };
    }
    if ((m = core.match(/^best-credit-cards-(.+)$/))) {
        return { leadType: 'credit-cards', specificNeed: m[1] };
    }
    if ((m = core.match(/^business-loans-(.+)-([a-z]{2})$/))) {
        return { leadType: 'business-loans', city: m[1] };
    }
    if (/^business-loans/.test(core)) {
        return { leadType: 'business-loans' };
    }
    if (/^personal-loans/.test(core)) {
        return { leadType: 'personal-loans' };
    }
    if (/^best-/.test(core)) {
        return { leadType: 'credit-cards' };
    }
    return out;
}

// ─────────── Segment → template + subject routing ───────────
// Rules are evaluated in order; the first match wins. Each rule declares
// which template file and subject line to use. {{city}} in subjects is
// replaced with the title-cased city name.

const ROUTES = [
    { match: { leadType: 'personal-loans', specificNeed: 'bad-credit' }, template: 'personal-loans-bad-credit', subject: 'Your bad credit loan guide is inside, {{firstName}}' },
    { match: { leadType: 'personal-loans', specificNeed: 'debt-consolidation' }, template: 'personal-loans-debt-consolidation', subject: 'Your debt consolidation guide, {{firstName}}' },
    { match: { leadType: 'personal-loans', specificNeed: 'home-improvement' }, template: 'personal-loans-home-improvement', subject: 'Fund your home project -- guide inside' },
    { match: { leadType: 'credit-cards', profession: 'nurses' }, template: 'credit-cards-nurses', subject: 'Best cards for nurses -- your guide, {{firstName}}' },
    { match: { leadType: 'credit-cards', specificNeed: 'cash-back' }, template: 'credit-cards-cash-back', subject: 'Maximize your cash back -- guide inside' },
    { match: { leadType: 'business-loans', cityRequired: true }, template: 'business-loans-city', subject: 'Business funding options in {{city}}, {{firstName}}' },
    // Leaf fallbacks by leadType -- keep the per-category welcomes as a backstop.
    { match: { leadType: 'personal-loans' }, template: 'welcome-personal-loans', subject: 'Your free loan guide is inside, {{firstName}}' },
    { match: { leadType: 'credit-cards' }, template: 'welcome-credit-cards', subject: 'Your credit card comparison guide, {{firstName}}' },
    { match: { leadType: 'business-loans' }, template: 'business-loans-city', subject: 'Your business funding guide, {{firstName}}' }
];

function pickRoute(segment) {
    for (const r of ROUTES) {
        const m = r.match;
        if (m.leadType && m.leadType !== segment.leadType) continue;
        if (m.specificNeed && m.specificNeed !== segment.specificNeed) continue;
        if (m.profession && m.profession !== segment.profession) continue;
        if (m.cityRequired && !segment.city) continue;
        return r;
    }
    return { template: 'fallback', subject: 'Your free financial guide, {{firstName}}' };
}

// ─────────── Helpers ───────────

function titleCase(slug) {
    if (!slug) return '';
    return slug.split('-').map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
}

function fillTemplate(str, vars) {
    return str.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));
}

// ─────────── Validation ───────────

function validate(payload) {
    const errors = [];
    if (!payload || typeof payload !== 'object') return ['Invalid body'];
    const firstName = (payload.firstName || '').toString().trim();
    const email = (payload.email || '').toString().trim();

    if (!firstName) errors.push('firstName is required');
    if (firstName.length > 100) errors.push('firstName too long');

    if (!email) errors.push('email is required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push('email is not a valid format');

    return errors;
}

// ─────────── Integrations ───────────

async function sendZapier(payload) {
    const url = process.env.ZAPIER_WEBHOOK_URL;
    if (!url) throw new Error('ZAPIER_WEBHOOK_URL is not set');
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Zapier webhook failed: ${res.status} ${body.slice(0, 200)}`);
    }
    return true;
}

async function sendResendEmail({ to, subject, html }) {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.FROM_EMAIL;
    if (!key) throw new Error('RESEND_API_KEY is not set');
    if (!from) throw new Error('FROM_EMAIL is not set');

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject, html })
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Resend failed: ${res.status} ${body.slice(0, 300)}`);
    }
    return res.json();
}

// ─────────── CORS ───────────

function cors(res, origin) {
    const allowed = /^(https?:\/\/(?:[^/]+\.)?mymoneymarketplace\.(com|github\.io))$/;
    const allow = origin && allowed.test(origin) ? origin : 'https://mymoneymarketplace.com';
    res.setHeader('Access-Control-Allow-Origin', allow);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
}

// ─────────── Handler ───────────

module.exports = async function handler(req, res) {
    cors(res, req.headers.origin);

    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = null; }
    }

    const errors = validate(body);
    if (errors.length) { res.status(400).json({ ok: false, errors }); return; }

    const firstName = body.firstName.trim();
    const email = body.email.trim().toLowerCase();

    // Build the canonical segment. Prefer explicit fields from the client;
    // fall back to re-parsing the referrer URL so legacy callers still route.
    const parsed = parsePageUrl(body.referrerPage);
    const segment = {
        leadType: body.leadType || parsed.leadType || 'personal-loans',
        specificNeed: body.specificNeed || parsed.specificNeed || '',
        profession: body.profession || parsed.profession || '',
        city: body.city || parsed.city || ''
    };

    const cityDisplay = titleCase(segment.city);

    // Full payload fan-out to Zapier (single source of truth for GHL tagging).
    const zapPayload = {
        firstName,
        email,
        leadType: segment.leadType,
        specificNeed: segment.specificNeed,
        profession: segment.profession,
        city: segment.city,
        cityDisplay,
        referrerPage: body.referrerPage || '',
        utmSource: body.utmSource || 'organic',
        utmMedium: body.utmMedium || 'parasite',
        utmCampaign: body.utmCampaign || body.campaign || '',
        timestamp: new Date().toISOString(),
        tags: ['mmm-lead', segment.leadType, segment.specificNeed, segment.profession, segment.city ? `city:${segment.city}` : '']
            .filter(Boolean)
    };

    const results = { zapier: null, email: null, route: null };

    try {
        await sendZapier(zapPayload);
        results.zapier = 'ok';
    } catch (err) {
        results.zapier = `error: ${err.message}`;
    }

    try {
        const route = pickRoute(segment);
        results.route = route.template;
        const tpl = loadTemplates()[route.template];
        if (!tpl) throw new Error(`Template not found: ${route.template}`);
        const vars = {
            firstName,
            city: cityDisplay || 'your area',
            unsubscribe_url: 'https://mymoneymarketplace.com/unsubscribe'
        };
        const html = fillTemplate(tpl, vars);
        const subject = fillTemplate(route.subject, vars);
        await sendResendEmail({ to: email, subject, html });
        results.email = 'ok';
    } catch (err) {
        results.email = `error: ${err.message}`;
    }

    const anyOk = results.zapier === 'ok' || results.email === 'ok';
    res.status(anyOk ? 200 : 502).json({ ok: anyOk, segment, results });
};

// Export the parser too for testing / reuse.
module.exports.parsePageUrl = parsePageUrl;
module.exports.pickRoute = pickRoute;
