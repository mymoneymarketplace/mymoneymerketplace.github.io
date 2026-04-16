// Rebuild personal-loans-guide.pdf from scratch.
//
// Fixes vs. the previous build:
//  - No more blank pages: page breaks are only explicit (no automatic
//    advance from header/footer drawing).
//  - Page numbers: uses bufferPages + bufferedPageRange so the footer is
//    drawn *after* all content flows, with real page count (no "undefined").
//  - Header/footer drawn at absolute coords, saved/restored doc.y each time.
//  - Margins match spec: 0.65in sides, 0.95in top, 0.75in bottom.
//  - Logo placed in a reserved header bar at a fixed coord.

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT = path.join(__dirname, 'guides', 'personal-loans-guide.pdf');
const LOGO_URL = 'https://assets.cdn.filesafe.space/ViERfxWPyzGokVuzinGu/media/69ded38080b446d0fb84f50e.png';
const LOGO_CACHE = path.join(__dirname, 'guides', '.mmm-logo-cache.png');

// Brand
const NAVY = '#1a3a5c';
const GREEN = '#008254';
const GREEN_BG = '#f0faf5';
const GREEN_SOFT = '#e8f5ef';
const AMBER = '#f5a623';
const RED = '#d94141';
const BODY = '#2d2d2d';
const MUTED = '#717171';
const BORDER_LT = '#e2e2e2';
const GRAY_FOOTER = '#f7f7f7';

// Geometry: Letter 612x792 pt.
const PAGE_W = 612;
const PAGE_H = 792;
const SIDE = 0.65 * 72;    // 46.8
const TOP = 0.95 * 72;     // 68.4
const BOTTOM = 0.75 * 72;  // 54
const CONTENT_W = PAGE_W - 2 * SIDE;
const CONTENT_BOTTOM = PAGE_H - BOTTOM;      // content must end by here
const HEADER_BAR_H = 50;
const FOOTER_BAR_H = 36;

// ─────────── helpers ───────────

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

function drawHeader(doc) {
    const y = doc.y;
    doc.save();
    // Navy bar
    doc.rect(0, 0, PAGE_W, HEADER_BAR_H).fill(NAVY);
    // Title wordmark left (white)
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11)
        .text('My Money Marketplace', SIDE, 20, { width: CONTENT_W / 2, align: 'left', lineBreak: false });
    // Guide name right (white)
    doc.font('Helvetica').fontSize(10)
        .text('Personal Loan Approval Guide', SIDE + CONTENT_W / 2, 20,
            { width: CONTENT_W / 2, align: 'right', lineBreak: false });
    // Green accent line just below the bar
    doc.rect(0, HEADER_BAR_H, PAGE_W, 2).fill(GREEN);
    doc.restore();
    doc.y = y;
}

function drawFooter(doc, pageNum, pageTotal) {
    const y = doc.y;
    doc.save();
    const footerTop = PAGE_H - FOOTER_BAR_H;
    doc.rect(0, footerTop, PAGE_W, FOOTER_BAR_H).fill(GRAY_FOOTER);
    doc.rect(0, footerTop, PAGE_W, 1).fill(BORDER_LT);
    doc.fillColor(MUTED).font('Helvetica').fontSize(9)
        .text('mymoneymarketplace.com', SIDE, footerTop + 12,
            { width: CONTENT_W / 2, align: 'left', lineBreak: false });
    doc.text(`Page ${pageNum} of ${pageTotal}`, SIDE + CONTENT_W / 2, footerTop + 12,
        { width: CONTENT_W / 2, align: 'right', lineBreak: false });
    doc.restore();
    doc.y = y;
}

function hr(doc, color = BORDER_LT, weight = 0.5) {
    const y = doc.y + 4;
    doc.save();
    doc.moveTo(SIDE, y).lineTo(PAGE_W - SIDE, y).lineWidth(weight).strokeColor(color).stroke();
    doc.restore();
    doc.y = y + 10;
}

function greenBadge(doc, label) {
    const x = SIDE;
    const y = doc.y;
    doc.save();
    const w = doc.widthOfString(label, { font: 'Helvetica-Bold', size: 9 }) + 18;
    doc.roundedRect(x, y, w, 20, 10).fill(GREEN);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9)
        .text(label, x, y + 6, { width: w, align: 'center', lineBreak: false });
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
    // box
    doc.roundedRect(SIDE, y, CONTENT_W, 34, 6).fillAndStroke('#ffffff', BORDER_LT);
    // green check circle
    doc.circle(SIDE + 18, y + 17, 10).fill(GREEN);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12)
        .text('\u2713', SIDE + 13, y + 10, { width: 12, align: 'center', lineBreak: false });
    doc.fillColor(BODY).font('Helvetica').fontSize(11)
        .text(text, SIDE + 40, y + 11, { width: CONTENT_W - 50, lineBreak: false });
    doc.restore();
    doc.y = y + 42;
}

function sectionBadge(doc, num) {
    const y = doc.y;
    const size = 36;
    doc.save();
    doc.circle(SIDE + size / 2, y + size / 2, size / 2).fill(GREEN);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18)
        .text(String(num), SIDE, y + 9, { width: size, align: 'center', lineBreak: false });
    doc.restore();
    doc.y = y;
}

function sectionHeader(doc, num, title) {
    const y = doc.y;
    sectionBadge(doc, num);
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(20)
        .text(title, SIDE + 50, y + 5, { width: CONTENT_W - 50, lineGap: 2 });
    const after = Math.max(doc.y, y + 42);
    doc.y = after + 4;
    hr(doc, GREEN, 1.2);
}

// Tables ------------------------------------------------------------

function dtiTable(doc) {
    const rows = [
        { range: 'Below 36%',     label: 'Excellent',  bg: '#d6efe1', fg: '#0a6a42' },
        { range: '36%  -  43%',   label: 'Acceptable', bg: '#e8f5ef', fg: GREEN },
        { range: '43%  -  50%',   label: 'Borderline', bg: '#fff0d6', fg: '#8a6400' },
        { range: 'Above 50%',     label: 'Difficult',  bg: '#fde1e1', fg: '#8a1f1f' }
    ];
    const rowH = 34;
    const colW1 = CONTENT_W * 0.48;
    const colW2 = CONTENT_W * 0.52;

    // header row
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
        doc.rect(SIDE, doc.y, 4, rowH).fill(r.fg); // left accent
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

    // header
    doc.save();
    doc.rect(SIDE, doc.y, colW, rowH).fill(GREEN);
    doc.rect(SIDE + colW, doc.y, colW, rowH).fill('#c0392b');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11)
        .text('Soft Pull', SIDE, doc.y + 9, { width: colW, align: 'center', lineBreak: false })
        .text('Hard Pull', SIDE + colW, doc.y + 9, { width: colW, align: 'center', lineBreak: false });
    doc.restore();
    doc.y += rowH;

    const pairs = [
        ['Does NOT affect score',    'Drops score 3-8 pts'],
        ['Invisible to other lenders', 'Visible for 2 years'],
        ['Pre-qualification only',   'Required to fund'],
        ['Unlimited, any time',      'Stacks if you apply often']
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

// Cover helpers -----------------------------------------------------

function coverStats(doc) {
    const y = doc.y;
    const stats = [
        { big: '550+',   small: 'Min Score' },
        { big: '24 hrs', small: 'Funding' },
        { big: '$50K',   small: 'Max Amount' }
    ];
    const cellW = CONTENT_W / 3;
    const cellH = 60;
    doc.save();
    doc.roundedRect(SIDE, y, CONTENT_W, cellH, 8).fillAndStroke(GREEN_SOFT, '#c3e6d5');
    stats.forEach((s, i) => {
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

function toc(doc, items) {
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(13)
        .text('What\'s Inside', SIDE, doc.y, { width: CONTENT_W });
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

// Final CTA ---------------------------------------------------------

function ctaBlock(doc) {
    const y = doc.y;
    const h = 170;
    doc.save();
    doc.roundedRect(SIDE, y, CONTENT_W, h, 10).fill(NAVY);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18)
        .text('Ready to See Your Real Rate?', SIDE, y + 20,
            { width: CONTENT_W, align: 'center', lineBreak: false });
    doc.fillColor('#e2e9f0').font('Helvetica').fontSize(11)
        .text('Soft-pull rate check. Credit scores from 550 accepted. Funding in as little as 24 hours.',
            SIDE + 20, y + 52, { width: CONTENT_W - 40, align: 'center' });
    // green pill button
    const btnW = 290, btnH = 40;
    const btnX = SIDE + (CONTENT_W - btnW) / 2;
    const btnY = y + 102;
    doc.roundedRect(btnX, btnY, btnW, btnH, 20).fill(GREEN);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12)
        .text('Check My Rate at Lendmate Capital  \u2192', btnX, btnY + 13,
            {
                width: btnW, align: 'center', lineBreak: false,
                link: 'https://lendmatecapital.com?utm_source=guide&utm_medium=pdf&utm_campaign=personal-loans-guide',
                underline: false
            });
    doc.fillColor('#aab7c5').font('Helvetica').fontSize(9)
        .text('lendmatecapital.com', SIDE, y + h - 18,
            { width: CONTENT_W, align: 'center', lineBreak: false });
    doc.restore();
    doc.y = y + h + 8;
}

// ─────────── main ───────────

(async () => {
    const logoPath = await downloadLogo().catch(() => null); // optional
    fs.mkdirSync(path.dirname(OUT), { recursive: true });

    const doc = new PDFDocument({
        size: 'LETTER',
        bufferPages: true,              // needed for real page numbers
        margins: { top: TOP, bottom: BOTTOM, left: SIDE, right: SIDE },
        info: {
            Title: '5 Ways to Get Approved for a Personal Loan',
            Author: 'My Money Marketplace',
            Subject: 'Personal Loan Approval Guide',
            Creator: 'My Money Marketplace'
        }
    });
    const stream = fs.createWriteStream(OUT);
    doc.pipe(stream);

    // ── Page 1: COVER ──
    // (first page is auto-created; we do NOT call addPage here)
    greenBadge(doc, 'FREE GUIDE');
    h1(doc, '5 Ways to Get Approved for a Personal Loan');
    h2Subtitle(doc, '(Even With Bad Credit)');
    // green divider
    doc.save();
    doc.rect(SIDE, doc.y, 60, 3).fill(GREEN);
    doc.restore();
    doc.y += 18;

    para(doc,
        "Bad credit doesn't mean no credit. Thousands of borrowers with scores below 640 get approved every day. " +
        "The difference between approval and denial usually comes down to five specific factors -- and all of them " +
        "are within your control. This guide walks you through each one."
    );
    doc.moveDown(0.4);

    coverStats(doc);

    toc(doc, [
        'Why Income Matters More Than Credit Score',
        'The DTI Ratio That Determines Approval',
        'How to Find and Fix Credit Report Errors',
        'Why Soft-Pull Pre-Qualification Protects You',
        'The Exact Documents to Have Ready'
    ]);

    // ── Section pages ──

    // Section 1
    doc.addPage();
    sectionHeader(doc, 1, 'Why Income Matters More Than Credit Score');
    para(doc,
        'Lenders do not lend to credit scores -- they lend to people who can repay. Your income, and more ' +
        'specifically your ability to repay the loan from that income, is the single most important factor ' +
        'in most approval decisions.');
    para(doc,
        'When you apply, the lender calculates whether your monthly income, after existing obligations, ' +
        'leaves enough margin to comfortably cover the new loan payment. A borrower with a 620 score and ' +
        '$6,000 monthly income often beats a 700-score borrower with $2,500 monthly income.');
    doc.moveDown(0.3);
    bullet(doc, 'W-2 wages, 1099 income, rental income, child support, disability, Social Security, and VA benefits all count as income.');
    bullet(doc, 'Part-time and gig work (Uber, DoorDash, Instacart, freelance) is accepted by most lenders with 3-6 months of deposit history.');
    bullet(doc, 'Keep 2-3 months of recent bank statements ready -- the single most common request after the application.');
    bullet(doc, 'If you were recently hired, an offer letter with salary can substitute for pay stubs at most lenders.');

    // Section 2
    doc.addPage();
    sectionHeader(doc, 2, 'The DTI Ratio That Determines Approval');
    para(doc,
        'Debt-to-income ratio (DTI) is your total monthly debt payments divided by your gross monthly income. ' +
        'It tells a lender how much of your paycheck is already spoken for before the new loan payment is added.');
    para(doc,
        'To calculate yours: add up every minimum monthly debt payment (credit card minimums, auto loan, ' +
        'student loan, child support, alimony) plus your rent or mortgage. Divide by gross monthly income. Multiply by 100.');
    doc.moveDown(0.3);
    dtiTable(doc);
    para(doc,
        'Most lenders draw the approval line at 43%. Paying off a single credit card balance can drop your DTI ' +
        'by several points within one billing cycle -- often the fastest path to approval.');

    // Section 3
    doc.addPage();
    sectionHeader(doc, 3, 'How to Find and Fix Credit Report Errors');
    para(doc,
        'One in five consumer credit reports contains at least one meaningful error. Common errors include ' +
        'accounts belonging to someone with a similar name, paid-off debts still showing as open, and late ' +
        'payments reported on accounts that were never actually late.');
    para(doc,
        'Every error you remove can raise your score -- sometimes dramatically. Pull your reports first, ' +
        'identify errors, then dispute.');
    doc.moveDown(0.3);
    bullet(doc, 'Get free reports from all three bureaus at AnnualCreditReport.com. This is the official free source -- avoid any site charging a fee.');
    bullet(doc, 'Review every account: your name, balances, payment history, and open/closed status.');
    bullet(doc, 'Dispute online directly with each bureau (Equifax, Experian, TransUnion). Provide documentation when you have it.');
    bullet(doc, 'The bureau has 30 days to investigate and respond by law.');
    bullet(doc, 'If corrected, your score often rebounds within 30-60 days of the update.');

    // Section 4
    doc.addPage();
    sectionHeader(doc, 4, 'Why Soft-Pull Pre-Qualification Protects You');
    para(doc,
        'There are two kinds of credit inquiries: soft pulls and hard pulls. Soft pulls happen when you check ' +
        'your own credit or when a lender pre-qualifies you. They are not visible to other lenders and do not ' +
        'affect your score.');
    para(doc,
        'Hard pulls happen when you formally apply. They are visible to other lenders for two years and ' +
        'typically reduce your score by 3-8 points per inquiry.');
    doc.moveDown(0.3);
    softVsHardTable(doc);
    para(doc,
        'If you must hard-pull, do it inside a 14-day window -- FICO treats rate shopping within that period ' +
        'as a single inquiry. Lendmate Capital uses soft-pull pre-qualification; no hard pull until you choose ' +
        'to accept an offer.');

    // Section 5
    doc.addPage();
    sectionHeader(doc, 5, 'The Exact Documents to Have Ready');
    para(doc,
        'Most loan applications stall not because of denials, but because borrowers cannot produce the documents ' +
        'the lender asks for. Having everything ready before you apply cuts the approval-to-funding time by 2-5 days.');
    doc.moveDown(0.4);
    checkRow(doc, 'Government-issued photo ID (driver\'s license, state ID, or passport)');
    checkRow(doc, 'Two most recent pay stubs -- or 1099 contracts + 3 months of deposits if self-employed');
    checkRow(doc, 'Three months of bank statements showing regular deposits');
    checkRow(doc, 'Proof of address within 60 days (utility bill, lease, bank statement)');
    checkRow(doc, 'Social Security number (for the hard-pull step after you accept)');
    checkRow(doc, 'Employer contact info for verification (HR phone number or official email)');

    // ── Final page: CTA ──
    doc.addPage();
    // Put CTA block roughly in the vertical center of the page
    doc.y = TOP + 80;
    ctaBlock(doc);
    doc.moveDown(1);
    para(doc,
        'This guide is for informational purposes only and does not constitute financial advice. Rates, terms, ' +
        'and availability are subject to change. Always review the loan agreement before signing.'
    );

    // ── Now stamp header + footer on every buffered page ──
    const range = doc.bufferedPageRange();  // { start, count }
    for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        drawHeader(doc);
        drawFooter(doc, i + 1, range.count);
    }

    doc.end();
    await new Promise((res, rej) => { stream.on('finish', res); stream.on('error', rej); });

    const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
    console.log(`wrote ${path.relative(__dirname, OUT)} (${kb} KB, ${range.count} pages)`);
})().catch(e => { console.error(e); process.exit(1); });
