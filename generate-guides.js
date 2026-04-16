// Generate 3 branded PDF guides (personal loans, credit cards, debt consolidation).
// Uses pdfkit. Logo is fetched from the MMM CDN at build time.

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT_DIR = path.join(__dirname, 'guides');
const LOGO_URL = 'https://assets.cdn.filesafe.space/ViERfxWPyzGokVuzinGu/media/69ded38080b446d0fb84f50e.png';
const LOGO_CACHE = path.join(__dirname, 'guides', '.mmm-logo-cache.png');
const GREEN = '#008254';
const BODY = '#333333';
const MUTED = '#717171';
const BORDER = '#e2e2e2';

function downloadLogo() {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(LOGO_CACHE)) return resolve(LOGO_CACHE);
        const file = fs.createWriteStream(LOGO_CACHE);
        https.get(LOGO_URL, res => {
            if (res.statusCode !== 200) {
                reject(new Error(`Logo fetch failed: ${res.statusCode}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => file.close(() => resolve(LOGO_CACHE)));
        }).on('error', reject);
    });
}

// ─────────── Guide content ───────────

const GUIDES = [
    {
        file: 'personal-loans-guide.pdf',
        title: '5 Ways to Get Approved for a Personal Loan',
        subtitle: '(Even With Bad Credit)',
        headerShort: 'Personal Loan Approval Guide',
        intro: 'Bad credit does not mean no credit. Thousands of borrowers with scores below 640 are approved for personal loans every day. The difference between approval and denial usually comes down to five specific factors -- and all of them are within your control. This guide walks you through each one.',
        sections: [
            {
                title: '1. Why Income Matters More Than Credit Score',
                paragraphs: [
                    'Lenders do not lend to credit scores -- they lend to people who can repay. Your income, and more specifically your ability to repay the loan from that income, is the single most important factor in most approval decisions.',
                    'When you apply, the lender calculates whether your monthly income, after existing obligations, leaves enough margin to comfortably cover the new loan payment. A borrower with a 620 score and $6,000 monthly income will often beat a 700-score borrower with $2,500 monthly income.'
                ],
                bullets: [
                    'Document every income source -- W-2 wages, 1099 income, rental income, child support, disability, Social Security, and VA benefits all count.',
                    'Part-time and gig work (Uber, DoorDash, Instacart, freelance) is accepted by most lenders with 3-6 months of deposit history.',
                    'Keep 2-3 months of recent bank statements ready. They are the single most common request after the application.',
                    'If you were recently hired, an offer letter with salary can substitute for pay stubs at most lenders.'
                ]
            },
            {
                title: '2. The DTI Ratio That Determines Approval',
                paragraphs: [
                    'Debt-to-income ratio (DTI) is your total monthly debt payments divided by your gross monthly income. It tells a lender how much of your paycheck is already spoken for before the new loan payment is added.',
                    'To calculate yours: add up every minimum monthly debt payment (credit card minimums, auto loan, student loan, child support, alimony) plus your rent or mortgage. Divide that total by your gross monthly income. Multiply by 100.'
                ],
                bullets: [
                    'Below 36% DTI: excellent -- most lenders approve.',
                    '36%-43% DTI: acceptable -- most mainstream lenders still approve.',
                    '43%-50% DTI: borderline -- specialty bad-credit lenders typically cap here.',
                    'Above 50% DTI: very difficult -- pay down a card or two before applying.',
                    'Tip: paying off a single credit card balance can drop your DTI by several points within a billing cycle.'
                ]
            },
            {
                title: '3. How to Find and Fix Credit Report Errors',
                paragraphs: [
                    'One in five consumer credit reports contains at least one meaningful error. Common errors include accounts belonging to someone else with a similar name, paid-off debts still showing as open, and late payments reported on accounts that were never actually late.',
                    'Every error you remove can raise your score -- sometimes dramatically. Pull your reports first, identify errors, then dispute.'
                ],
                bullets: [
                    'Get your free reports from all three bureaus at AnnualCreditReport.com. This is the official free source -- avoid any site charging a fee.',
                    'Review every account: your name, balances, payment history, and open/closed status.',
                    'Dispute online directly with each bureau (Equifax, Experian, TransUnion). Provide documentation when you have it.',
                    'The bureau has 30 days to investigate and respond by law.',
                    'If corrected, your score often rebounds within 30-60 days of the update.'
                ]
            },
            {
                title: '4. Why Soft-Pull Pre-Qualification Protects You',
                paragraphs: [
                    'There are two kinds of credit inquiries: soft pulls and hard pulls. Soft pulls happen when you check your own credit or when a lender pre-qualifies you. They are not visible to other lenders and do not affect your score.',
                    'Hard pulls happen when you formally apply for credit. They are visible to other lenders for two years and typically reduce your score by 3-8 points per inquiry.'
                ],
                bullets: [
                    'Always start with soft-pull pre-qualification. You see real rates without any credit impact.',
                    'Applying to five lenders at once with hard pulls can drop your score 20-40 points and make every subsequent lender more cautious.',
                    'If you must hard-pull, do it inside a 14-day window -- FICO treats rate shopping within that period as a single inquiry.',
                    'Lendmate Capital uses a soft-pull pre-qualification. No hard pull until you choose to accept an offer.'
                ]
            },
            {
                title: '5. The Exact Documents to Have Ready',
                paragraphs: [
                    'Most loan applications stall not because of denials, but because borrowers cannot produce the documents the lender asks for. Having everything ready before you apply cuts the approval-to-funding time by 2-5 days.'
                ],
                bullets: [
                    'Government-issued photo ID (driver\'s license, state ID, or passport).',
                    'Two most recent pay stubs -- or 1099 contracts + 3 months of deposits if self-employed.',
                    'Three months of bank statements showing regular deposits.',
                    'Proof of address within 60 days (utility bill, lease agreement, bank statement).',
                    'Social Security number (for the hard-pull step after you accept).',
                    'Employer contact info for verification (HR phone number or official email).'
                ]
            }
        ],
        closing: {
            heading: 'Ready to See Your Real Rate?',
            body: 'Lendmate Capital accepts applicants with credit scores starting at 550. Rate check is a soft pull and does not affect your credit score. Most approved loans fund in 1-3 business days.',
            ctaLabel: 'Check My Rate at Lendmate',
            ctaUrl: 'https://lendmatecapital.com?utm_source=guide&utm_medium=pdf&utm_campaign=personal-loans-guide'
        }
    },
    {
        file: 'credit-cards-guide.pdf',
        title: 'How to Choose the Right Credit Card',
        subtitle: 'for Your Spending (2026 Edition)',
        headerShort: 'Credit Card Selection Guide',
        intro: 'There are more than 500 consumer credit cards on the market. Most borrowers pick based on a flashy welcome bonus and end up with a card that is wrong for how they actually spend. This guide shows you how to pick a card that pays you back every month -- not just in the first 90 days.',
        sections: [
            {
                title: '1. The One Question to Ask Before Picking a Card',
                paragraphs: [
                    'Before looking at any card, pull up your last three months of credit card or debit card statements and answer a single question: where do I spend the most money?',
                    'Most people guess wrong. They think "dining out" is their biggest category, but grocery + gas often dwarf it. Others assume they travel a lot -- then realize they only flew twice last year. Real data from real statements beats intuition every time.'
                ],
                bullets: [
                    'Total your spend in six buckets: groceries, gas, dining, travel, online shopping, and everything else.',
                    'The category that tops $300/month is the one your card should reward.',
                    'If no single category clears $300, a flat-rate card is almost certainly the better pick.'
                ]
            },
            {
                title: '2. Flat Rate vs. Category Cash Back -- Which Wins',
                paragraphs: [
                    'A flat-rate card earns the same percentage on every purchase (typically 1.5%-2%). A category card earns a higher percentage in specific categories (3%-6%) and a lower rate on everything else.',
                    'The breakeven is surprisingly simple: if at least 50% of your spend falls inside the bonus category, the category card wins. If your spending is spread across many small categories, the flat-rate card wins every time.'
                ],
                bullets: [
                    'Example: 2% flat on $2,000/month = $40/month = $480/year.',
                    'Example: 5% on groceries ($500/month) + 1% on everything else ($1,500) = $40/month = also $480/year. Same result -- but only if you hit $500 in groceries every month.',
                    'If you cannot commit to tracking categories, the flat-rate card is the lazy-proof choice.'
                ]
            },
            {
                title: '3. How to Calculate If an Annual Fee Is Worth It',
                paragraphs: [
                    'An annual fee is only justified if the card\'s annual rewards plus recurring credits exceed the fee by a margin big enough to justify the mental overhead.',
                    'The math: (expected annual rewards) + (credits you actually use) -- (annual fee) = net value. If net value is negative or thin, pick a no-fee card instead.'
                ],
                bullets: [
                    'Count only credits you will actually redeem -- a $300 travel credit is worth $0 if you never travel.',
                    'A $95 fee card needs to generate about $200/year in rewards to be a clear win over a no-fee 2% card.',
                    'Premium cards ($395-$695 fees) only make sense for heavy travelers who use airport lounges, Global Entry/TSA PreCheck credits, and hotel elite status.'
                ]
            },
            {
                title: '4. The Welcome Bonus Math Nobody Shows You',
                paragraphs: [
                    'Welcome bonuses look huge ("$200 after $500 spend in 3 months") but the real math matters. Break down what the bonus is worth per dollar spent to compare offers fairly.',
                    'A $200 bonus after $500 spend is a 40% effective return on that spend. Compare that to a 60,000-point bonus after $4,000 spend -- roughly 1.5% at a typical 1 cent/point redemption. The smaller absolute number can be the better offer.'
                ],
                bullets: [
                    'Do not spend money you would not otherwise spend to hit a bonus. That destroys the value.',
                    'If the spend requirement is more than 3x your typical 3-month spend, pass.',
                    'Check how the bonus is paid -- some are cash, some are points worth 1-2 cents each depending on redemption.'
                ]
            },
            {
                title: '5. The Two-Card Strategy That Maximizes Everything',
                paragraphs: [
                    'For most spenders, the highest earnings come from pairing two cards: one category bonus card for your biggest spending area, and one flat-rate 2% card for everything else.',
                    'This setup is simple enough to use without a spreadsheet and captures 90%+ of the rewards possible with complex three- and four-card setups.'
                ],
                bullets: [
                    'Card 1: bonus card for your #1 category (e.g., 6% grocery, 5% rotating, 4% dining).',
                    'Card 2: flat-rate 2% card for everything the bonus card does not cover.',
                    'Use Card 1 for the bonus category. Use Card 2 for everything else.',
                    'Result: typically 3-4% blended return across all spend with minimal complexity.'
                ]
            }
        ],
        closing: {
            heading: 'Ready to Compare Cards?',
            body: 'We curate the best cards across every category -- cash back, travel, balance transfer, and business. See side-by-side comparisons and pick the right card for your actual spending.',
            ctaLabel: 'Compare Credit Cards',
            ctaUrl: 'https://lendmatecapital.com/compare-credit-cards?utm_source=guide&utm_medium=pdf&utm_campaign=credit-cards-guide'
        }
    },
    {
        file: 'debt-consolidation-guide.pdf',
        title: 'The Complete Guide to Debt Consolidation',
        subtitle: 'Is It Right for You?',
        headerShort: 'Debt Consolidation Guide',
        intro: 'Debt consolidation sounds simple: combine all your debts into one loan with one payment. But whether it actually saves you money -- and whether it is the right move for your situation -- depends on a few specific factors. This guide walks through the math and the mindset.',
        sections: [
            {
                title: '1. What Debt Consolidation Actually Means',
                paragraphs: [
                    'Debt consolidation is the process of taking out a new, usually fixed-rate loan to pay off multiple existing debts. The most common case is paying off several high-rate credit cards with a single lower-rate personal loan.',
                    'The key word is "replace." You do not erase the debt -- you move it from multiple high-rate revolving accounts to a single fixed-rate installment loan with a clear payoff date.'
                ],
                bullets: [
                    'Revolving debt (credit cards) becomes installment debt (personal loan) -- which often helps your credit score.',
                    'Multiple payments become one payment with a fixed monthly amount.',
                    'Variable APRs become one locked APR for the life of the loan.',
                    'Term is typically 2-7 years, with most borrowers choosing 3-5.'
                ]
            },
            {
                title: '2. The Math: How Much Could You Save',
                paragraphs: [
                    'The true test of consolidation is whether the APR on the new loan is meaningfully lower than the weighted average APR of the debts you are consolidating.',
                    'Calculate your weighted average APR: multiply each balance by its APR, sum the results, then divide by the total balance. If your consolidation loan APR is 3 or more percentage points below that number, you will save money. If not, consolidation may hurt more than help.'
                ],
                bullets: [
                    'Example: $5,000 at 24% + $3,000 at 22% + $2,000 at 26% = weighted average 23.6% APR.',
                    'Consolidating $10,000 at 12% APR over 4 years saves roughly $2,400 in interest.',
                    'Lower rate + fixed term = predictable payoff date.',
                    'Use any consolidation calculator to confirm your specific numbers before applying.'
                ]
            },
            {
                title: '3. Five Signs Consolidation Is Right for You',
                paragraphs: [
                    'Consolidation is a tool, not a magic fix. It works in specific situations and fails in others. Here are the clearest signs it is the right move.'
                ],
                bullets: [
                    'Your credit card APRs are 18%+ and you can qualify for a personal loan at 12-15%.',
                    'You are paying minimums every month but the balances barely move.',
                    'You have three or more accounts and keeping track is becoming a burden.',
                    'Your income is stable and you can handle the new fixed monthly payment.',
                    'You are committed to not running new balances on the paid-off cards.'
                ]
            },
            {
                title: '4. Three Signs You Should Consider Other Options',
                paragraphs: [
                    'Not every debt situation is helped by consolidation. If any of the below apply, look at alternatives first.'
                ],
                bullets: [
                    'The consolidation loan rate is within 2% of your existing rates -- the savings will not justify the new inquiry and account.',
                    'You have a history of running balances back up after paying cards down. Without a behavior change, consolidation just gives you more rope.',
                    'Your debt is primarily from a temporary income drop and you expect to recover in 3-6 months. A 0% balance transfer card or calling your card issuer for a hardship plan may work better.',
                    'If total debt exceeds 50% of your annual income, talk to a nonprofit credit counselor before taking any new loan.'
                ]
            },
            {
                title: '5. Step by Step: How to Apply and What to Expect',
                paragraphs: [
                    'Once you have decided consolidation is the right move, the application process is straightforward. Most online lenders complete the process in 1-3 business days end-to-end.'
                ],
                bullets: [
                    'Step 1: List every debt, its balance, APR, and minimum payment. Add up the total.',
                    'Step 2: Pre-qualify with 2-3 lenders using soft pulls to see real rates.',
                    'Step 3: Choose the offer with the lowest APR that also fits your monthly budget.',
                    'Step 4: Complete the formal application -- this triggers one hard pull.',
                    'Step 5: Funds arrive in your account in 1-3 business days. Use them to pay off each old account within 48 hours.',
                    'Step 6: Keep the paid-off cards open (do not cancel) to preserve your credit utilization and account age.'
                ]
            }
        ],
        closing: {
            heading: 'Ready to Check Your Consolidation Rate?',
            body: 'Lendmate Capital offers fixed-rate consolidation loans up to $50,000 with soft-pull pre-qualification and funding in 1-3 business days. See your rate in 2 minutes.',
            ctaLabel: 'Check My Consolidation Rate',
            ctaUrl: 'https://lendmatecapital.com?utm_source=guide&utm_medium=pdf&utm_campaign=debt-consolidation-guide'
        }
    }
];

// ─────────── Render ───────────

function renderGuide(logoPath, guide) {
    return new Promise((resolve, reject) => {
        const outPath = path.join(OUT_DIR, guide.file);
        const doc = new PDFDocument({
            size: 'LETTER',
            margins: { top: 100, bottom: 80, left: 72, right: 72 },
            info: {
                Title: guide.title,
                Author: 'My Money Marketplace',
                Subject: guide.headerShort,
                Creator: 'My Money Marketplace'
            }
        });

        const stream = fs.createWriteStream(outPath);
        doc.pipe(stream);

        // Header + footer on every page. Re-entry guard prevents recursion
        // when drawing near page edges would otherwise trigger a new page.
        let drawing = false;
        const drawHeaderFooter = () => {
            if (drawing) return;
            drawing = true;
            const savedY = doc.y;
            try {
                try {
                    doc.image(logoPath, 72, 40, { height: 28 });
                } catch (_) { /* ignore */ }
                doc.fontSize(9).fillColor(MUTED).font('Helvetica')
                    .text(guide.headerShort, 300, 48, { width: 240, align: 'right', lineBreak: false });
                doc.moveTo(72, 78).lineTo(540, 78).strokeColor(BORDER).lineWidth(0.5).stroke();

                const pageNum = doc.page.number;
                doc.fontSize(9).fillColor(MUTED).font('Helvetica')
                    .text('mymoneymarketplace.com', 72, 750, { width: 200, align: 'left', lineBreak: false })
                    .text(`Page ${pageNum}`, 300, 750, { width: 240, align: 'right', lineBreak: false });
            } finally {
                doc.y = savedY;
                drawing = false;
            }
        };

        doc.on('pageAdded', drawHeaderFooter);
        drawHeaderFooter();

        // Cover / Title block
        doc.moveDown(2);
        doc.fontSize(28).fillColor('#111111').font('Helvetica-Bold')
            .text(guide.title, { align: 'left' });
        doc.moveDown(0.2);
        doc.fontSize(18).fillColor(GREEN).font('Helvetica-Bold')
            .text(guide.subtitle, { align: 'left' });
        doc.moveDown(1.2);
        doc.fontSize(11).fillColor(BODY).font('Helvetica')
            .text(guide.intro, { align: 'left', lineGap: 4 });
        doc.moveDown(1.5);

        // Sections
        for (const s of guide.sections) {
            // avoid orphan section headings at page bottom
            if (doc.y > 620) doc.addPage();
            doc.fontSize(15).fillColor(GREEN).font('Helvetica-Bold')
                .text(s.title, { align: 'left' });
            doc.moveDown(0.4);
            doc.fontSize(11).fillColor(BODY).font('Helvetica');
            for (const p of s.paragraphs) {
                doc.text(p, { align: 'left', lineGap: 3 });
                doc.moveDown(0.6);
            }
            if (s.bullets && s.bullets.length) {
                doc.list(s.bullets, {
                    bulletRadius: 2,
                    textIndent: 8,
                    bulletIndent: 4,
                    lineGap: 3
                });
                doc.moveDown(0.8);
            }
        }

        // Closing CTA
        if (doc.y > 600) doc.addPage();
        doc.moveDown(0.8);
        doc.rect(72, doc.y, 468, 110).fillAndStroke('#f0faf5', '#c3e6d5');
        const boxTop = doc.y;
        doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(16)
            .text(guide.closing.heading, 88, boxTop + 16, { width: 436 });
        doc.fillColor(BODY).font('Helvetica').fontSize(11)
            .text(guide.closing.body, 88, boxTop + 42, { width: 436, lineGap: 3 });
        doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(12)
            .text(`${guide.closing.ctaLabel}  \u2192`, 88, boxTop + 88, {
                width: 436,
                link: guide.closing.ctaUrl,
                underline: true
            });
        doc.y = boxTop + 130;

        doc.end();
        stream.on('finish', () => resolve(outPath));
        stream.on('error', reject);
    });
}

(async () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const logoPath = await downloadLogo();
    for (const g of GUIDES) {
        const p = await renderGuide(logoPath, g);
        const size = (fs.statSync(p).size / 1024).toFixed(1);
        console.log(`wrote ${path.relative(__dirname, p)} (${size} KB)`);
    }
})().catch(e => { console.error(e); process.exit(1); });
