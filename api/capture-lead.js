// Lead capture serverless handler.
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
// back to hitting the Zapier webhook directly (Zapier can also send the welcome
// email via its own Resend step -- see GHL notes at the bottom).
//
// GHL AUTOMATION TO CREATE IN GOHIGHLEVEL:
// 1. Create workflow trigger: Webhook received
// 2. Tag contact with lead type
// 3. Add to appropriate pipeline stage
// 4. Start email sequence based on leadType tag:
//    - personal-loans tag -> Personal Loans Nurture sequence
//    - credit-cards tag -> Credit Cards Nurture sequence
//    - business-loans tag -> Business Loans Nurture sequence
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

// Lead type → welcome template + subject line.
const LEAD_CONFIG = {
    'personal-loans': {
        template: 'welcome-personal-loans',
        subject: 'Your free loan guide is inside, {{firstName}}'
    },
    'debt-consolidation': {
        template: 'welcome-personal-loans',
        subject: 'Your free debt consolidation guide, {{firstName}}'
    },
    'credit-cards': {
        template: 'welcome-credit-cards',
        subject: 'Your credit card comparison guide, {{firstName}}'
    },
    'business-loans': {
        template: 'welcome-personal-loans', // TODO: swap to welcome-business-loans when created
        subject: 'Your business loan resources, {{firstName}}'
    }
};

// ─────────── Validation ───────────

function validate(payload) {
    const errors = [];
    if (!payload || typeof payload !== 'object') {
        return ['Invalid body'];
    }
    const firstName = (payload.firstName || '').toString().trim();
    const email = (payload.email || '').toString().trim();

    if (!firstName) errors.push('firstName is required');
    if (firstName.length > 100) errors.push('firstName too long');

    // Simple RFC5322-lite email check -- good enough for form validation.
    if (!email) errors.push('email is required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push('email is not a valid format');

    if (payload.leadType && !LEAD_CONFIG[payload.leadType]) {
        errors.push(`unknown leadType: ${payload.leadType}`);
    }

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
        headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ from, to, subject, html })
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Resend failed: ${res.status} ${body.slice(0, 300)}`);
    }
    return res.json();
}

// ─────────── Helpers ───────────

function fillTemplate(str, vars) {
    return str.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));
}

function cors(res, origin) {
    // Allow the GitHub Pages origin and any subdomain of mymoneymarketplace.com.
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

    // Body can arrive parsed (Vercel) or as a string (Netlify).
    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = null; }
    }

    const errors = validate(body);
    if (errors.length) {
        res.status(400).json({ ok: false, errors });
        return;
    }

    const firstName = body.firstName.trim();
    const email = body.email.trim().toLowerCase();
    const leadType = body.leadType || 'personal-loans';
    const config = LEAD_CONFIG[leadType];

    const zapPayload = {
        firstName,
        email,
        source: body.referrerPage || 'unknown',
        leadType,
        utmSource: body.utmSource || 'organic',
        utmMedium: body.utmMedium || 'parasite',
        utmCampaign: body.campaign || body.utmCampaign || leadType,
        timestamp: new Date().toISOString(),
        tags: ['mmm-lead', leadType]
    };

    // Step 2: Zapier webhook (primary CRM path). We don't block the email
    // send on Zapier success so the user still gets a fast confirmation.
    const results = { zapier: null, email: null };
    try {
        await sendZapier(zapPayload);
        results.zapier = 'ok';
    } catch (err) {
        results.zapier = `error: ${err.message}`;
    }

    // Step 3: welcome email via Resend
    try {
        const tpl = loadTemplates()[config.template];
        if (!tpl) throw new Error(`Template not found: ${config.template}`);
        const html = fillTemplate(tpl, { firstName, unsubscribe_url: 'https://mymoneymarketplace.com/unsubscribe' });
        const subject = fillTemplate(config.subject, { firstName });
        await sendResendEmail({ to: email, subject, html });
        results.email = 'ok';
    } catch (err) {
        results.email = `error: ${err.message}`;
    }

    // Step 4: respond. We return 200 if at least one side-effect succeeded --
    // the user has no remediation path if one integration is down.
    const anyOk = results.zapier === 'ok' || results.email === 'ok';
    res.status(anyOk ? 200 : 502).json({ ok: anyOk, results });
};
