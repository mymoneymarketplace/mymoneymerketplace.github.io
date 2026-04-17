// Build all three MMM guide PDFs with a clean pattern.
//
// Fix for "phantom extra pages at the end":
//  - We use `bufferPages: true`, write all content with explicit addPage()
//    calls, then post-hoc stamp the header + footer on every page via
//    `doc.switchToPage(i)`.
//  - Inside header/footer drawing we set `doc.page.margins.bottom = 0` and
//    `doc.page.margins.top = 0` temporarily. Without this, pdfkit's text
//    renderer sees the absolute-y footer coordinate (y=758) as "past the
//    usable area" (bottom margin 54 -> maxY 738) and auto-appends a new
//    empty page -- which was causing 7-page guides to balloon to 21.
//  - No content is written from onFirstPage / onLaterPages style handlers.
//    Everything flows top-down, header/footer stamped once, no duplication.

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT_DIR = path.join(__dirname, 'guides');
const LOGO_URL = 'https://assets.cdn.filesafe.space/ViERfxWPyzGokVuzinGu/media/69ded38080b446d0fb84f50e.png';
const LOGO_CACHE = path.join(OUT_DIR, '.mmm-logo-cache.png');

// Brand
const NAVY = '#1a3a5c';
const GREEN = '#008254';
const GREEN_SOFT = '#e8f5ef';
const BODY = '#2d2d2d';
const MUTED = '#717171';
const BORDER_LT = '#e2e2e2';
const GRAY_FOOTER = '#f7f7f7';

// Geometry: Letter 612x792 pt. Spec margins: 0.65 sides, 0.95 top, 0.75 bottom.
const PAGE_W = 612;
const PAGE_H = 792;
const SIDE = 0.65 * 72;
const TOP = 0.95 * 72;
const BOTTOM = 0.75 * 72;
const CONTENT_W = PAGE_W - 2 * SIDE;
const HEADER_BAR_H = 50;
const FOOTER_BAR_H = 36;

// ─────────── utils ───────────

function downloadLogo() {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(LOGO_CACHE)) return resolve(LOGO_CACHE);
        fs.mkdirSync(path.dirname(LOGO_CACHE), { recursive: true });
        const file = fs.createWriteStream(LOGO_CACHE);
        https.get(LOGO_URL, res => {
            if (res.statusCode !== 200) return reject(new Error('logo fetch ' + res.statusCode));
            res.pipe(file);
            file.on('finish', () => file.close(() => resolve(LOGO_CACHE)));
        }).on('error', reject);
    });
}

// THE CRUCIAL FIX: any text drawn outside the content area (header bar, footer
// bar) must run with margins temporarily zeroed so pdfkit doesn't auto-paginate.
function safeText(doc, text, x, y, opts = {}) {
    const savedTop = doc.page.margins.top;
    const savedBottom = doc.page.margins.bottom;
    const savedY = doc.y;
    doc.page.margins.top = 0;
    doc.page.margins.bottom = 0;
    try {
        doc.text(text, x, y, { lineBreak: false, ...opts });
    } finally {
        doc.page.margins.top = savedTop;
        doc.page.margins.bottom = savedBottom;
        doc.y = savedY;
    }
}

function drawHeader(doc, guideTitle) {
    doc.save();
    doc.rect(0, 0, PAGE_W, HEADER_BAR_H).fill(NAVY);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11);
    safeText(doc, 'My Money Marketplace', SIDE, 20, { width: CONTENT_W / 2, align: 'left' });
    doc.font('Helvetica').fontSize(10);
    safeText(doc, guideTitle, SIDE + CONTENT_W / 2, 21,
        { width: CONTENT_W / 2, align: 'right' });
    doc.rect(0, HEADER_BAR_H, PAGE_W, 2).fill(GREEN);
    doc.restore();
}

function drawFooter(doc, pageNum, pageTotal) {
    doc.save();
    const footerTop = PAGE_H - FOOTER_BAR_H;
    doc.rect(0, footerTop, PAGE_W, FOOTER_BAR_H).fill(GRAY_FOOTER);
    doc.rect(0, footerTop, PAGE_W, 1).fill(BORDER_LT);
    doc.fillColor(MUTED).font('Helvetica').fontSize(9);
    safeText(doc, 'mymoneymarketplace.com', SIDE, footerTop + 12,
        { width: CONTENT_W / 2, align: 'left' });
    safeText(doc, `Page ${pageNum} of ${pageTotal}`, SIDE + CONTENT_W / 2, footerTop + 12,
        { width: CONTENT_W / 2, align: 'right' });
    doc.restore();
}

// ─────────── flow helpers ───────────

function hr(doc, color = BORDER_LT, weight = 0.5) {
    const y = doc.y + 4;
    doc.save();
    doc.moveTo(SIDE, y).lineTo(PAGE_W - SIDE, y).lineWidth(weight).strokeColor(color).stroke();
    doc.restore();
    doc.y = y + 10;
}

function greenBadge(doc, label) {
    const y = doc.y;
    const w = doc.widthOfString(label, { font: 'Helvetica-Bold', size: 9 }) + 18;
    doc.save();
    doc.roundedRect(SIDE, y, w, 20, 10).fill(GREEN);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
        .text(label, SIDE, y + 6, { width: w, align: 'center', lineBreak: false });
    doc.restore();
    doc.y = y + 28;
}

function h1(doc, text) {
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(26)
        .text(text, SIDE, doc.y, { width: CONTENT_W, lineGap: 2 });
    doc.moveDown(0.2);
}

function h2Subtitle(doc, text) {
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(16)
        .text(text, SIDE, doc.y, { width: CONTENT_W });
    doc.moveDown(0.8);
}

function para(doc, text) {
    doc.fillColor(BODY).font('Helvetica').fontSize(11)
        .text(text, SIDE, doc.y, { width: CONTENT_W, align: 'left', lineGap: 3 });
    doc.moveDown(0.5);
}

function bullet(doc, text) {
    const y = doc.y;
    doc.save();
    doc.circle(SIDE + 4, y + 6, 2).fill(GREEN);
    doc.restore();
    doc.fillColor(BODY).font('Helvetica').fontSize(11)
        .text(text, SIDE + 14, y, { width: CONTENT_W - 14, lineGap: 2 });
    doc.moveDown(0.25);
}

function checkRow(doc, text) {
    const y = doc.y;
    doc.save();
    doc.roundedRect(SIDE, y, CONTENT_W, 34, 6).fillAndStroke('#ffffff', BORDER_LT);
    doc.circle(SIDE + 18, y + 17, 10).fill(GREEN);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12)
        .text('\u2713', SIDE + 13, y + 10, { width: 12, align: 'center', lineBreak: false });
    doc.fillColor(BODY).font('Helvetica').fontSize(11)
        .text(text, SIDE + 40, y + 11, { width: CONTENT_W - 50, lineBreak: false });
    doc.restore();
    doc.y = y + 42;
}

function sectionHeader(doc, num, title) {
    const y = doc.y;
    const size = 36;
    doc.save();
    doc.circle(SIDE + size / 2, y + size / 2, size / 2).fill(GREEN);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18)
        .text(String(num), SIDE, y + 9, { width: size, align: 'center', lineBreak: false });
    doc.restore();
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(20)
        .text(title, SIDE + 50, y + 5, { width: CONTENT_W - 50, lineGap: 2 });
    doc.y = Math.max(doc.y, y + 42) + 4;
    hr(doc, GREEN, 1.2);
}

function coverStats(doc, cells) {
    const y = doc.y;
    const cellW = CONTENT_W / cells.length;
    const cellH = 60;
    doc.save();
    doc.roundedRect(SIDE, y, CONTENT_W, cellH, 8).fillAndStroke(GREEN_SOFT, '#c3e6d5');
    cells.forEach((s, i) => {
        const x = SIDE + cellW * i;
        doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(22)
            .text(s.big, x, y + 10, { width: cellW, align: 'center', lineBreak: false });
        doc.fillColor(MUTED).font('Helvetica').fontSize(10)
            .text(s.small, x, y + 38, { width: cellW, align: 'center', lineBreak: false });
        if (i > 0) {
            doc.moveTo(x, y + 12).lineTo(x, y + cellH - 12)
                .lineWidth(0.5).strokeColor('#c3e6d5').stroke();
        }
    });
    doc.restore();
    doc.y = y + cellH + 14;
}

function toc(doc, items, label = "What's Inside") {
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(13)
        .text(label, SIDE, doc.y, { width: CONTENT_W });
    doc.moveDown(0.3);
    items.forEach((t, i) => {
        const y = doc.y;
        doc.save();
        doc.roundedRect(SIDE, y, CONTENT_W, 28, 4).fillAndStroke('#ffffff', BORDER_LT);
        doc.circle(SIDE + 18, y + 14, 10).fill(GREEN);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10)
            .text(String(i + 1), SIDE + 8, y + 9, { width: 20, align: 'center', lineBreak: false });
        doc.fillColor(BODY).font('Helvetica').fontSize(11)
            .text(t, SIDE + 40, y + 8, { width: CONTENT_W - 50, lineBreak: false });
        doc.restore();
        doc.y = y + 32;
    });
}

function ctaBlock(doc, { heading, body, buttonLabel, buttonUrl, domain }) {
    const y = doc.y;
    const h = 170;
    doc.save();
    doc.roundedRect(SIDE, y, CONTENT_W, h, 10).fill(NAVY);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18)
        .text(heading, SIDE, y + 20,
            { width: CONTENT_W, align: 'center', lineBreak: false });
    doc.fillColor('#e2e9f0').font('Helvetica').fontSize(11)
        .text(body, SIDE + 20, y + 52, { width: CONTENT_W - 40, align: 'center' });
    const btnW = 300, btnH = 40;
    const btnX = SIDE + (CONTENT_W - btnW) / 2;
    const btnY = y + 102;
    doc.roundedRect(btnX, btnY, btnW, btnH, 20).fill(GREEN);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12)
        .text(`${buttonLabel}  \u2192`, btnX, btnY + 13,
            { width: btnW, align: 'center', lineBreak: false, link: buttonUrl });
    doc.fillColor('#aab7c5').font('Helvetica').fontSize(9)
        .text(domain, SIDE, y + h - 18,
            { width: CONTENT_W, align: 'center', lineBreak: false });
    doc.restore();
    doc.y = y + h + 8;
}

function dtiTable(doc) {
    const rows = [
        { range: 'Below 36%',   label: 'Excellent',  bg: '#d6efe1', fg: '#0a6a42' },
        { range: '36%  -  43%', label: 'Acceptable', bg: '#e8f5ef', fg: GREEN },
        { range: '43%  -  50%', label: 'Borderline', bg: '#fff0d6', fg: '#8a6400' },
        { range: 'Above 50%',   label: 'Difficult',  bg: '#fde1e1', fg: '#8a1f1f' }
    ];
    const rowH = 34;
    const colW1 = CONTENT_W * 0.48;
    const colW2 = CONTENT_W * 0.52;

    doc.save();
    doc.rect(SIDE, doc.y, CONTENT_W, rowH).fill(NAVY);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11)
        .text('DTI Range', SIDE + 14, doc.y + 11, { width: colW1 - 14, lineBreak: false })
        .text('Lender View', SIDE + colW1 + 14, doc.y + 11, { width: colW2 - 14, lineBreak: false });
    doc.restore();
    doc.y += rowH;

    for (const r of rows) {
        doc.save();
        doc.rect(SIDE, doc.y, CONTENT_W, rowH).fill(r.bg);
        doc.rect(SIDE, doc.y, 4, rowH).fill(r.fg);
        doc.fillColor('#111111').font('Helvetica-Bold').fontSize(11)
            .text(r.range, SIDE + 14, doc.y + 11, { width: colW1 - 14, lineBreak: false });
        doc.fillColor(r.fg).font('Helvetica-Bold').fontSize(11)
            .text(r.label, SIDE + colW1 + 14, doc.y + 11, { width: colW2 - 14, lineBreak: false });
        doc.restore();
        doc.y += rowH;
    }
    doc.moveDown(0.6);
}

function softVsHardTable(doc) {
    const rowH = 28;
    const colW = CONTENT_W / 2;
    doc.save();
    doc.rect(SIDE, doc.y, colW, rowH).fill(GREEN);
    doc.rect(SIDE + colW, doc.y, colW, rowH).fill('#c0392b');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11)
        .text('Soft Pull', SIDE, doc.y + 9, { width: colW, align: 'center', lineBreak: false })
        .text('Hard Pull', SIDE + colW, doc.y + 9, { width: colW, align: 'center', lineBreak: false });
    doc.restore();
    doc.y += rowH;

    const pairs = [
        ['Does NOT affect score', 'Drops score 3-8 pts'],
        ['Invisible to other lenders', 'Visible for 2 years'],
        ['Pre-qualification only', 'Required to fund'],
        ['Unlimited, any time', 'Stacks if you apply often']
    ];
    const bodyH = 34;
    for (let i = 0; i < pairs.length; i++) {
        const [l, r] = pairs[i];
        const bg = i % 2 === 0 ? '#ffffff' : GRAY_FOOTER;
        doc.save();
        doc.rect(SIDE, doc.y, CONTENT_W, bodyH).fill(bg);
        doc.rect(SIDE, doc.y, CONTENT_W, bodyH).lineWidth(0.5).stroke(BORDER_LT);
        doc.moveTo(SIDE + colW, doc.y).lineTo(SIDE + colW, doc.y + bodyH).stroke(BORDER_LT);
        doc.fillColor(BODY).font('Helvetica').fontSize(11)
            .text(l, SIDE + 10, doc.y + 10, { width: colW - 20, align: 'center', lineBreak: false })
            .text(r, SIDE + colW + 10, doc.y + 10, { width: colW - 20, align: 'center', lineBreak: false });
        doc.restore();
        doc.y += bodyH;
    }
    doc.moveDown(0.6);
}

function savingsTable(doc) {
    // Before / After comparison for debt consolidation
    const rowH = 28;
    const col1 = CONTENT_W * 0.40;
    const col2 = CONTENT_W * 0.30;
    const col3 = CONTENT_W * 0.30;

    doc.save();
    doc.rect(SIDE, doc.y, CONTENT_W, rowH).fill(NAVY);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10)
        .text('Metric', SIDE + 12, doc.y + 10, { width: col1 - 12, lineBreak: false })
        .text('Before', SIDE + col1, doc.y + 10, { width: col2, align: 'center', lineBreak: false })
        .text('After', SIDE + col1 + col2, doc.y + 10, { width: col3, align: 'center', lineBreak: false });
    doc.restore();
    doc.y += rowH;

    const rows = [
        ['Payments',       '4 separate',    '1 payment'],
        ['Average APR',    '22% APR',       '12% APR'],
        ['Total Interest', '$7,840',        '$3,116'],
        ['Monthly Total',  '$600+',         '$332']
    ];
    for (let i = 0; i < rows.length; i++) {
        const [m, b, a] = rows[i];
        const bg = i % 2 === 0 ? '#ffffff' : GRAY_FOOTER;
        doc.save();
        doc.rect(SIDE, doc.y, CONTENT_W, rowH).fill(bg);
        doc.rect(SIDE, doc.y, CONTENT_W, rowH).lineWidth(0.5).stroke(BORDER_LT);
        doc.fillColor(BODY).font('Helvetica').fontSize(11)
            .text(m, SIDE + 12, doc.y + 9, { width: col1 - 12, lineBreak: false });
        doc.fillColor('#c0392b').font('Helvetica-Bold').fontSize(11)
            .text(b, SIDE + col1, doc.y + 9, { width: col2, align: 'center', lineBreak: false });
        doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(11)
            .text(a, SIDE + col1 + col2, doc.y + 9, { width: col3, align: 'center', lineBreak: false });
        doc.restore();
        doc.y += rowH;
    }
    doc.moveDown(0.6);
}

// ─────────── PDF builders ───────────

async function buildPersonalLoansGuide() {
    const doc = newDoc('5 Ways to Get Approved for a Personal Loan',
        'Personal Loan Approval Guide');

    // Cover
    greenBadge(doc, 'FREE GUIDE');
    h1(doc, '5 Ways to Get Approved for a Personal Loan');
    h2Subtitle(doc, '(Even With Bad Credit)');
    doc.save(); doc.rect(SIDE, doc.y, 60, 3).fill(GREEN); doc.restore();
    doc.y += 18;
    para(doc,
        "Bad credit doesn't mean no credit. Thousands of borrowers with scores below 640 get approved every day. " +
        "The difference between approval and denial usually comes down to five specific factors -- and all of them " +
        "are within your control. This guide walks you through each one.");
    doc.moveDown(0.4);
    coverStats(doc, [
        { big: '550+', small: 'Min Score' },
        { big: '24 hrs', small: 'Funding' },
        { big: '$50K', small: 'Max Amount' }
    ]);
    toc(doc, [
        'Why Income Matters More Than Credit Score',
        'The DTI Ratio That Determines Approval',
        'How to Find and Fix Credit Report Errors',
        'Why Soft-Pull Pre-Qualification Protects You',
        'The Exact Documents to Have Ready'
    ]);

    // Section 1
    doc.addPage();
    sectionHeader(doc, 1, 'Why Income Matters More Than Credit Score');
    para(doc, 'Lenders do not lend to credit scores -- they lend to people who can repay. Your income, and more specifically your ability to repay the loan from that income, is the single most important factor in most approval decisions.');
    para(doc, 'When you apply, the lender calculates whether your monthly income, after existing obligations, leaves enough margin to comfortably cover the new loan payment. A borrower with a 620 score and $6,000 monthly income often beats a 700-score borrower with $2,500 monthly income.');
    doc.moveDown(0.3);
    bullet(doc, 'W-2 wages, 1099 income, rental income, child support, disability, Social Security, and VA benefits all count as income.');
    bullet(doc, 'Part-time and gig work (Uber, DoorDash, Instacart, freelance) is accepted with 3-6 months of deposit history.');
    bullet(doc, 'Keep 2-3 months of recent bank statements ready -- the single most common request after the application.');
    bullet(doc, 'If you were recently hired, an offer letter with salary can substitute for pay stubs at most lenders.');

    // Section 2
    doc.addPage();
    sectionHeader(doc, 2, 'The DTI Ratio That Determines Approval');
    para(doc, 'Debt-to-income ratio (DTI) is your total monthly debt payments divided by your gross monthly income. It tells a lender how much of your paycheck is already spoken for before the new loan payment is added.');
    para(doc, 'To calculate yours: add every minimum monthly debt payment (credit card minimums, auto loan, student loan, child support, alimony) plus your rent or mortgage. Divide by gross monthly income. Multiply by 100.');
    doc.moveDown(0.3);
    dtiTable(doc);
    para(doc, 'Most lenders draw the approval line at 43%. Paying off a single credit card balance can drop your DTI by several points within one billing cycle -- often the fastest path to approval.');

    // Section 3
    doc.addPage();
    sectionHeader(doc, 3, 'How to Find and Fix Credit Report Errors');
    para(doc, 'One in five consumer credit reports contains at least one meaningful error. Common errors include accounts belonging to someone with a similar name, paid-off debts still showing as open, and late payments reported on accounts that were never actually late.');
    para(doc, 'Every error you remove can raise your score -- sometimes dramatically. Pull your reports first, identify errors, then dispute.');
    doc.moveDown(0.3);
    bullet(doc, 'Get free reports from all three bureaus at AnnualCreditReport.com. This is the official free source -- avoid any site charging a fee.');
    bullet(doc, 'Review every account: your name, balances, payment history, and open/closed status.');
    bullet(doc, 'Dispute online directly with each bureau (Equifax, Experian, TransUnion). Provide documentation when you have it.');
    bullet(doc, 'The bureau has 30 days to investigate and respond by law.');
    bullet(doc, 'If corrected, your score often rebounds within 30-60 days of the update.');

    // Section 4
    doc.addPage();
    sectionHeader(doc, 4, 'Why Soft-Pull Pre-Qualification Protects You');
    para(doc, 'There are two kinds of credit inquiries: soft pulls and hard pulls. Soft pulls happen when you check your own credit or when a lender pre-qualifies you. They are not visible to other lenders and do not affect your score.');
    para(doc, 'Hard pulls happen when you formally apply. They are visible to other lenders for two years and typically reduce your score by 3-8 points per inquiry.');
    doc.moveDown(0.3);
    softVsHardTable(doc);
    para(doc, 'If you must hard-pull, do it inside a 14-day window -- FICO treats rate shopping within that period as a single inquiry. Lendmate Capital uses soft-pull pre-qualification; no hard pull until you choose to accept an offer.');

    // Section 5
    doc.addPage();
    sectionHeader(doc, 5, 'The Exact Documents to Have Ready');
    para(doc, 'Most loan applications stall not because of denials, but because borrowers cannot produce the documents the lender asks for. Having everything ready before you apply cuts the approval-to-funding time by 2-5 days.');
    doc.moveDown(0.4);
    checkRow(doc, 'Government-issued photo ID (driver\'s license, state ID, or passport)');
    checkRow(doc, 'Two most recent pay stubs -- or 1099 contracts + 3 months of deposits if self-employed');
    checkRow(doc, 'Three months of bank statements showing regular deposits');
    checkRow(doc, 'Proof of address within 60 days (utility bill, lease, bank statement)');
    checkRow(doc, 'Social Security number (for the hard-pull step after you accept)');
    checkRow(doc, 'Employer contact info for verification (HR phone number or official email)');

    // CTA
    doc.addPage();
    doc.y = TOP + 80;
    ctaBlock(doc, {
        heading: 'Ready to See Your Real Rate?',
        body: 'Soft-pull rate check. Credit scores from 550 accepted. Funding in as little as 24 hours.',
        buttonLabel: 'Check My Rate at Lendmate Capital',
        buttonUrl: 'https://lendmatecapital.com?utm_source=guide&utm_medium=pdf&utm_campaign=personal-loans-guide',
        domain: 'lendmatecapital.com'
    });
    doc.moveDown(1);
    para(doc, 'This guide is for informational purposes only and does not constitute financial advice. Rates, terms, and availability are subject to change. Always review the loan agreement before signing.');

    return finalize(doc, 'personal-loans-guide.pdf', 'Personal Loan Approval Guide');
}

async function buildCreditCardsGuide() {
    const doc = newDoc('How to Choose the Right Credit Card',
        'Credit Card Selection Guide');

    greenBadge(doc, 'FREE GUIDE');
    h1(doc, 'How to Choose the Right Credit Card');
    h2Subtitle(doc, 'for Your Spending (2026 Edition)');
    doc.save(); doc.rect(SIDE, doc.y, 60, 3).fill(GREEN); doc.restore();
    doc.y += 18;
    para(doc,
        'There are more than 500 consumer credit cards on the market. Most borrowers pick based on a flashy ' +
        'welcome bonus and end up with a card that is wrong for how they actually spend. This guide shows you ' +
        'how to pick a card that pays you back every month -- not just in the first 90 days.');
    doc.moveDown(0.4);
    coverStats(doc, [
        { big: '2-6%',  small: 'Cash Back Range' },
        { big: '$200+', small: 'Welcome Bonuses' },
        { big: '2 Card', small: 'Optimal Setup' }
    ]);
    toc(doc, [
        'The One Question to Ask Before Picking a Card',
        'Flat Rate vs. Category Cash Back -- Which Wins',
        'How to Calculate If an Annual Fee Is Worth It',
        'The Welcome Bonus Math Nobody Shows You',
        'The Two-Card Strategy That Maximizes Everything'
    ]);

    doc.addPage();
    sectionHeader(doc, 1, 'The One Question to Ask Before Picking a Card');
    para(doc, 'Before looking at any card, pull up your last three months of credit card or debit card statements and answer a single question: where do I spend the most money?');
    para(doc, 'Most people guess wrong. They think "dining out" is their biggest category, but grocery + gas often dwarf it. Others assume they travel a lot -- then realize they only flew twice last year. Real data from real statements beats intuition every time.');
    doc.moveDown(0.3);
    bullet(doc, 'Total your spend in six buckets: groceries, gas, dining, travel, online shopping, and everything else.');
    bullet(doc, 'The category that tops $300/month is the one your card should reward.');
    bullet(doc, 'If no single category clears $300, a flat-rate card is almost certainly the better pick.');

    doc.addPage();
    sectionHeader(doc, 2, 'Flat Rate vs. Category Cash Back -- Which Wins');
    para(doc, 'A flat-rate card earns the same percentage on every purchase (typically 1.5%-2%). A category card earns a higher percentage in specific categories (3%-6%) and a lower rate on everything else.');
    para(doc, 'The breakeven is surprisingly simple: if at least 50% of your spend falls inside the bonus category, the category card wins. If your spending is spread across many small categories, the flat-rate card wins every time.');
    doc.moveDown(0.3);
    bullet(doc, 'Example: 2% flat on $2,000/month = $40/month = $480/year.');
    bullet(doc, 'Example: 5% on groceries ($500/month) + 1% on everything else ($1,500) = $40/month = also $480/year. Same result -- but only if you hit $500 in groceries every month.');
    bullet(doc, 'If you cannot commit to tracking categories, the flat-rate card is the lazy-proof choice.');

    doc.addPage();
    sectionHeader(doc, 3, 'How to Calculate If an Annual Fee Is Worth It');
    para(doc, 'An annual fee is only justified if the card\'s annual rewards plus recurring credits exceed the fee by a margin big enough to justify the mental overhead.');
    para(doc, 'The math: (expected annual rewards) + (credits you actually use) -- (annual fee) = net value. If net value is negative or thin, pick a no-fee card instead.');
    doc.moveDown(0.3);
    bullet(doc, 'Count only credits you will actually redeem -- a $300 travel credit is worth $0 if you never travel.');
    bullet(doc, 'A $95 fee card needs to generate about $200/year in rewards to be a clear win over a no-fee 2% card.');
    bullet(doc, 'Premium cards ($395-$695 fees) only make sense for heavy travelers who use airport lounges, Global Entry/TSA PreCheck credits, and hotel elite status.');

    doc.addPage();
    sectionHeader(doc, 4, 'The Welcome Bonus Math Nobody Shows You');
    para(doc, 'Welcome bonuses look huge ("$200 after $500 spend in 3 months") but the real math matters. Break down what the bonus is worth per dollar spent to compare offers fairly.');
    para(doc, 'A $200 bonus after $500 spend is a 40% effective return on that spend. Compare that to a 60,000-point bonus after $4,000 spend -- roughly 1.5% at a typical 1 cent/point redemption. The smaller absolute number can be the better offer.');
    doc.moveDown(0.3);
    bullet(doc, 'Do not spend money you would not otherwise spend to hit a bonus. That destroys the value.');
    bullet(doc, 'If the spend requirement is more than 3x your typical 3-month spend, pass.');
    bullet(doc, 'Check how the bonus is paid -- some are cash, some are points worth 1-2 cents each depending on redemption.');

    doc.addPage();
    sectionHeader(doc, 5, 'The Two-Card Strategy That Maximizes Everything');
    para(doc, 'For most spenders, the highest earnings come from pairing two cards: one category bonus card for your biggest spending area, and one flat-rate 2% card for everything else.');
    para(doc, 'This setup is simple enough to use without a spreadsheet and captures 90%+ of the rewards possible with complex three- and four-card setups.');
    doc.moveDown(0.3);
    bullet(doc, 'Card 1: bonus card for your #1 category (e.g., 6% grocery, 5% rotating, 4% dining).');
    bullet(doc, 'Card 2: flat-rate 2% card for everything the bonus card does not cover.');
    bullet(doc, 'Use Card 1 for the bonus category. Use Card 2 for everything else.');
    bullet(doc, 'Result: typically 3-4% blended return across all spend with minimal complexity.');

    doc.addPage();
    doc.y = TOP + 80;
    ctaBlock(doc, {
        heading: 'Ready to Compare Cards?',
        body: 'See the best cards across every category -- cash back, travel, balance transfer, and business.',
        buttonLabel: 'Compare Credit Cards',
        buttonUrl: 'https://lendmatecapital.com/compare-credit-cards?utm_source=guide&utm_medium=pdf&utm_campaign=credit-cards-guide',
        domain: 'lendmatecapital.com/compare-credit-cards'
    });

    return finalize(doc, 'credit-cards-guide.pdf', 'Credit Card Selection Guide');
}

async function buildDebtConsolidationGuide() {
    const doc = newDoc('The Complete Guide to Debt Consolidation',
        'Debt Consolidation Guide');

    greenBadge(doc, 'FREE GUIDE');
    h1(doc, 'The Complete Guide to Debt Consolidation');
    h2Subtitle(doc, 'Is It Right for You?');
    doc.save(); doc.rect(SIDE, doc.y, 60, 3).fill(GREEN); doc.restore();
    doc.y += 18;
    para(doc,
        'Debt consolidation sounds simple: combine all your debts into one loan with one payment. But whether ' +
        'it actually saves you money -- and whether it is the right move for your situation -- depends on a few ' +
        'specific factors. This guide walks through the math and the mindset.');
    doc.moveDown(0.4);
    coverStats(doc, [
        { big: '$4,200+', small: 'Avg Savings' },
        { big: '1',       small: 'Payment' },
        { big: '12%',     small: 'Target APR' }
    ]);
    toc(doc, [
        'What Debt Consolidation Actually Means',
        'The Math: How Much Could You Save',
        '5 Signs Consolidation Is Right for You',
        '3 Signs You Should Consider Other Options',
        'Step by Step: How to Apply and What to Expect'
    ]);

    doc.addPage();
    sectionHeader(doc, 1, 'What Debt Consolidation Actually Means');
    para(doc, 'Debt consolidation is the process of taking out a new, usually fixed-rate loan to pay off multiple existing debts. The most common case is paying off several high-rate credit cards with a single lower-rate personal loan.');
    para(doc, 'The key word is "replace." You do not erase the debt -- you move it from multiple high-rate revolving accounts to a single fixed-rate installment loan with a clear payoff date.');
    doc.moveDown(0.3);
    bullet(doc, 'Revolving debt (credit cards) becomes installment debt (personal loan) -- which often helps your credit score.');
    bullet(doc, 'Multiple payments become one payment with a fixed monthly amount.');
    bullet(doc, 'Variable APRs become one locked APR for the life of the loan.');
    bullet(doc, 'Term is typically 2-7 years, with most borrowers choosing 3-5.');

    doc.addPage();
    sectionHeader(doc, 2, 'The Math: How Much Could You Save');
    para(doc, 'The true test of consolidation is whether the APR on the new loan is meaningfully lower than the weighted average APR of the debts you are consolidating.');
    para(doc, 'Calculate your weighted average APR: multiply each balance by its APR, sum the results, then divide by the total balance. If your consolidation loan APR is 3 or more percentage points below that number, you will save money.');
    doc.moveDown(0.3);
    savingsTable(doc);
    para(doc, 'Example above: $15,000 in credit card debt at ~22% vs. a $15,000 consolidation loan at ~12% APR over 4 years. The savings on interest alone is more than $4,700.');

    doc.addPage();
    sectionHeader(doc, 3, '5 Signs Consolidation Is Right for You');
    para(doc, 'Consolidation is a tool, not a magic fix. It works in specific situations and fails in others. Here are the clearest signs it is the right move.');
    doc.moveDown(0.3);
    bullet(doc, 'Your credit card APRs are 18%+ and you can qualify for a personal loan at 12-15%.');
    bullet(doc, 'You are paying minimums every month but the balances barely move.');
    bullet(doc, 'You have three or more accounts and keeping track is becoming a burden.');
    bullet(doc, 'Your income is stable and you can handle the new fixed monthly payment.');
    bullet(doc, 'You are committed to not running new balances on the paid-off cards.');

    doc.addPage();
    sectionHeader(doc, 4, '3 Signs You Should Consider Other Options');
    para(doc, 'Not every debt situation is helped by consolidation. If any of the below apply, look at alternatives first.');
    doc.moveDown(0.3);
    bullet(doc, 'The consolidation loan rate is within 2% of your existing rates -- the savings will not justify the new inquiry and account.');
    bullet(doc, 'You have a history of running balances back up after paying cards down. Without a behavior change, consolidation just gives you more rope.');
    bullet(doc, 'Your debt is primarily from a temporary income drop and you expect to recover in 3-6 months. A 0% balance transfer card or a hardship plan may work better.');
    bullet(doc, 'If total debt exceeds 50% of your annual income, talk to a nonprofit credit counselor before taking any new loan.');

    doc.addPage();
    sectionHeader(doc, 5, 'Step by Step: How to Apply and What to Expect');
    para(doc, 'Once you have decided consolidation is the right move, the application process is straightforward. Most online lenders complete the process in 1-3 business days end-to-end.');
    doc.moveDown(0.4);
    checkRow(doc, 'Step 1: List every debt, its balance, APR, and minimum payment.');
    checkRow(doc, 'Step 2: Pre-qualify with 2-3 lenders using soft pulls to see real rates.');
    checkRow(doc, 'Step 3: Choose the offer with the lowest APR that fits your monthly budget.');
    checkRow(doc, 'Step 4: Complete the formal application -- this triggers one hard pull.');
    checkRow(doc, 'Step 5: Funds arrive in 1-3 business days. Use them to pay off each old account within 48 hours.');
    checkRow(doc, 'Step 6: Keep the paid-off cards open (do not cancel) to preserve utilization and account age.');

    doc.addPage();
    doc.y = TOP + 80;
    ctaBlock(doc, {
        heading: 'Ready to Check Your Consolidation Rate?',
        body: 'Fixed-rate consolidation loans up to $50,000 with soft-pull pre-qualification. See your rate in 2 minutes.',
        buttonLabel: 'Check My Consolidation Rate',
        buttonUrl: 'https://lendmatecapital.com?utm_source=guide&utm_medium=pdf&utm_campaign=debt-consolidation-guide',
        domain: 'lendmatecapital.com'
    });

    return finalize(doc, 'debt-consolidation-guide.pdf', 'Debt Consolidation Guide');
}

// ─────────── shared doc lifecycle ───────────

let CURRENT_HEADER_TITLE = '';

function newDoc(title, headerTitle) {
    CURRENT_HEADER_TITLE = headerTitle;
    const doc = new PDFDocument({
        size: 'LETTER',
        bufferPages: true,
        margins: { top: TOP, bottom: BOTTOM, left: SIDE, right: SIDE },
        info: {
            Title: title,
            Author: 'My Money Marketplace',
            Subject: headerTitle,
            Creator: 'My Money Marketplace'
        }
    });
    return doc;
}

async function finalize(doc, outName, headerTitle) {
    const outPath = path.join(OUT_DIR, outName);
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    // Stamp header + footer on every page AFTER content is written.
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        drawHeader(doc, headerTitle);
        drawFooter(doc, i + 1, range.count);
    }

    doc.end();
    await new Promise((res, rej) => { stream.on('finish', res); stream.on('error', rej); });
    return { name: outName, pages: range.count, bytes: fs.statSync(outPath).size };
}

// ─────────── main ───────────

(async () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await downloadLogo().catch(() => null); // optional, not currently drawn in header

    const results = [];
    results.push(await buildPersonalLoansGuide());
    results.push(await buildCreditCardsGuide());
    results.push(await buildDebtConsolidationGuide());

    console.log('\nBuilt:');
    for (const r of results) {
        console.log(`  ${r.name.padEnd(32)} ${String(r.pages).padStart(2)} pages  ${(r.bytes / 1024).toFixed(1).padStart(7)} KB`);
    }
})().catch(e => { console.error(e); process.exit(1); });
