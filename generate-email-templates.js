// Generate segmented welcome-email templates for the lead-capture backend.
// One shell, per-segment content/CTA. All files land in email-templates/.

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'email-templates');
const LOGO = 'https://assets.cdn.filesafe.space/ViERfxWPyzGokVuzinGu/media/69ded38080b446d0fb84f50e.png';

function shell({ preheader, title, body }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#333333;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e2e2;">
      <tr><td style="padding:28px 32px;border-bottom:1px solid #e2e2e2;">
        <img src="${LOGO}" alt="My Money Marketplace" width="180" height="32" style="display:block;height:32px;width:auto;border:0;">
      </td></tr>
      <tr><td style="padding:32px;font-size:15px;line-height:1.7;color:#333333;">${body}</td></tr>
      <tr><td style="padding:22px 32px;background:#f7f7f7;border-top:1px solid #e2e2e2;font-size:12px;color:#717171;line-height:1.7;">
        <p style="margin:0 0 6px;">You received this because you requested our free guide.</p>
        <p style="margin:0 0 6px;">My Money Marketplace &middot; <a href="https://mymoneymarketplace.com" style="color:#008254;text-decoration:none;">mymoneymarketplace.com</a></p>
        <p style="margin:0;"><a href="{{unsubscribe_url}}" style="color:#717171;text-decoration:underline;">Unsubscribe</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
`;
}

function button(href, label) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr><td align="center" style="border-radius:8px;background:#008254;">
    <a href="${href}" style="display:inline-block;padding:14px 30px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">${label} &rarr;</a>
  </td></tr>
</table>`;
}

function greeting(tag = 'Hi {{firstName}},') {
    return `<p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#111111;">${tag}</p>`;
}

function divider() {
    return `<hr style="border:0;border-top:1px solid #e2e2e2;margin:28px 0;">`;
}

function footerCta({ heading, body, cta, url }) {
    return `${divider()}
<p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#111111;">${heading}</p>
<p style="margin:0 0 14px;">${body}</p>
${button(url, cta)}
<p style="margin:20px 0 0;font-size:13px;color:#717171;">Soft credit check. No impact to your score.</p>`;
}

// ─────────── Segment templates ───────────

const SEGMENTS = [

    {
        file: 'personal-loans-bad-credit.html',
        title: 'Your bad credit loan guide is inside',
        preheader: 'Lenders that work with scores starting at 550 -- no hard pull to check.',
        body: `${greeting()}
<p style="margin:0 0 14px;">Thanks for grabbing our guide. Here is your copy -- written specifically for borrowers working with credit scores from 550 to 650.</p>
${button('https://mymoneymarketplace.github.io/guides/personal-loans-guide.pdf', 'Download Your Free Guide')}
<p style="margin:0 0 14px;font-size:13px;color:#717171;">Inside: why income matters more than score, the DTI threshold most lenders use (43%), and the 5 documents that cut approval time by days.</p>
${footerCta({
            heading: 'Ready to see your actual rate?',
            body: 'Lendmate Capital accepts credit scores starting at 550. Rate check is a soft pull with zero impact to your credit.',
            cta: 'Check My Rate at Lendmate',
            url: 'https://lendmatecapital.com?utm_source=email&utm_medium=nurture&utm_campaign=personal-loans-bad-credit'
        })}`
    },

    {
        file: 'personal-loans-debt-consolidation.html',
        title: 'Your debt consolidation guide',
        preheader: 'Combine multiple card balances into one fixed payment.',
        body: `${greeting()}
<p style="margin:0 0 14px;">Thanks for requesting our debt consolidation guide. It walks through the exact math you need to decide if consolidating is worth it for your situation.</p>
${button('https://mymoneymarketplace.github.io/guides/debt-consolidation-guide.pdf', 'Download Your Free Guide')}
<p style="margin:0 0 14px;font-size:13px;color:#717171;">Inside: how to calculate your weighted-average APR, the 5 signs consolidation is right for you, and 3 signs you should consider other options.</p>
${footerCta({
            heading: 'See your consolidation rate',
            body: 'Lendmate Capital offers fixed-rate consolidation loans up to $50,000. Rate check takes 2 minutes and uses a soft credit pull.',
            cta: 'Check My Consolidation Rate',
            url: 'https://lendmatecapital.com?utm_source=email&utm_medium=nurture&utm_campaign=personal-loans-debt-consolidation'
        })}`
    },

    {
        file: 'personal-loans-home-improvement.html',
        title: 'Fund your home project',
        preheader: 'Finance kitchen, bath, or full-remodel projects with fixed rates.',
        body: `${greeting()}
<p style="margin:0 0 14px;">Thanks for grabbing our guide. Here is your copy:</p>
${button('https://mymoneymarketplace.github.io/guides/personal-loans-guide.pdf', 'Download Your Free Guide')}
<p style="margin:0 0 14px;font-size:13px;color:#717171;">Inside: why an unsecured loan often beats a HELOC for defined projects, how to match loan term to project life, and the documents that speed approval.</p>
${footerCta({
            heading: 'Ready to fund your project?',
            body: 'Lendmate Capital offers home-improvement loans up to $50,000 with no home appraisal or lien required. Fixed rate, fixed payment.',
            cta: 'Check My Rate at Lendmate',
            url: 'https://lendmatecapital.com?utm_source=email&utm_medium=nurture&utm_campaign=personal-loans-home-improvement'
        })}`
    },

    {
        file: 'credit-cards-nurses.html',
        title: 'Best cards for nurses',
        preheader: 'Cards that reward the spending nurses actually do -- gas, scrubs, coffee.',
        body: `${greeting()}
<p style="margin:0 0 14px;">Thanks for grabbing our guide. Here is your copy -- picked with healthcare schedules and spending patterns in mind.</p>
${button('https://mymoneymarketplace.github.io/guides/credit-cards-guide.pdf', 'Download Your Free Guide')}
<p style="margin:0 0 14px;font-size:13px;color:#717171;">Inside: the one question to ask before picking a card, when flat-rate beats category cash back, and the two-card strategy that captures 90% of possible rewards without the complexity.</p>
${footerCta({
            heading: 'Ready to compare cards?',
            body: 'See side-by-side comparisons of the best cards for nurses and healthcare workers -- scrubs, gas, streaming, and dining all included.',
            cta: 'Compare Cards Now',
            url: 'https://lendmatecapital.com/compare-credit-cards?utm_source=email&utm_medium=nurture&utm_campaign=credit-cards-nurses'
        })}`
    },

    {
        file: 'credit-cards-cash-back.html',
        title: 'Maximize your cash back',
        preheader: 'The category math that decides which cash-back card actually pays more.',
        body: `${greeting()}
<p style="margin:0 0 14px;">Thanks for grabbing our cash-back guide. Here is your copy:</p>
${button('https://mymoneymarketplace.github.io/guides/credit-cards-guide.pdf', 'Download Your Free Guide')}
<p style="margin:0 0 14px;font-size:13px;color:#717171;">Inside: the exact breakeven between flat-rate and category cards, how to calculate a welcome bonus's real value, and the two-card combo that captures ~90% of maximum rewards.</p>
${footerCta({
            heading: 'Ready to compare cash-back cards?',
            body: 'See the best 2%-6% cash-back cards side by side -- no application required to compare.',
            cta: 'Compare Cash-Back Cards',
            url: 'https://lendmatecapital.com/compare-credit-cards?utm_source=email&utm_medium=nurture&utm_campaign=credit-cards-cash-back'
        })}`
    },

    {
        file: 'business-loans-city.html',
        title: 'Business funding options in {{city}}',
        preheader: 'Small business loans, lines of credit, and equipment financing.',
        body: `${greeting()}
<p style="margin:0 0 14px;">Thanks for your interest in business funding. Whether you are scaling inventory, covering payroll, or buying equipment, a few quick notes on what works best for small businesses in {{city}}:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
  <tr>
    <td valign="top" width="44" style="padding:6px 0;"><div style="width:32px;height:32px;background:#f0faf5;border-radius:50%;text-align:center;line-height:32px;color:#008254;font-weight:700;font-size:16px;">&#10003;</div></td>
    <td valign="middle" style="padding:10px 0;font-size:15px;"><strong style="color:#111111;">Working capital</strong> -- fast funding for inventory, payroll, or marketing.</td>
  </tr>
  <tr>
    <td valign="top" width="44" style="padding:6px 0;"><div style="width:32px;height:32px;background:#f0faf5;border-radius:50%;text-align:center;line-height:32px;color:#008254;font-weight:700;font-size:16px;">&#10003;</div></td>
    <td valign="middle" style="padding:10px 0;font-size:15px;"><strong style="color:#111111;">Equipment financing</strong> -- use the equipment itself as collateral.</td>
  </tr>
  <tr>
    <td valign="top" width="44" style="padding:6px 0;"><div style="width:32px;height:32px;background:#f0faf5;border-radius:50%;text-align:center;line-height:32px;color:#008254;font-weight:700;font-size:16px;">&#10003;</div></td>
    <td valign="middle" style="padding:10px 0;font-size:15px;"><strong style="color:#111111;">Line of credit</strong> -- revolving capital, interest only on what you draw.</td>
  </tr>
</table>
${footerCta({
            heading: 'See what you qualify for',
            body: 'Lendmate Capital works with businesses across the U.S., including {{city}}. Soft-pull prequalification gets you a real rate in minutes.',
            cta: 'Check My Business Rate',
            url: 'https://lendmatecapital.com?utm_source=email&utm_medium=nurture&utm_campaign=business-loans-city'
        })}`
    },

    {
        file: 'fallback.html',
        title: 'Your free financial guide',
        preheader: 'Your guide + a rate check if you want it.',
        body: `${greeting()}
<p style="margin:0 0 14px;">Thanks for signing up. Here is your free guide:</p>
${button('https://mymoneymarketplace.github.io/guides/personal-loans-guide.pdf', 'Download Your Free Guide')}
<p style="margin:0 0 14px;font-size:13px;color:#717171;">Practical, specific advice you can act on today -- no fluff.</p>
${footerCta({
            heading: 'Ready to see real rates?',
            body: 'Our partners at Lendmate Capital offer soft-pull rate checks across personal, business, and consolidation loans.',
            cta: 'Check My Rate',
            url: 'https://lendmatecapital.com?utm_source=email&utm_medium=nurture&utm_campaign=fallback'
        })}`
    }

];

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const s of SEGMENTS) {
    const html = shell({ preheader: s.preheader, title: s.title, body: s.body });
    const outPath = path.join(OUT_DIR, s.file);
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`wrote ${path.relative(__dirname, outPath)}`);
}
console.log(`\nTotal: ${SEGMENTS.length} segment templates`);
