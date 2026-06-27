const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authorEmail = 'kermitkwif@gmail.com';

// Delete old adapted posts first
const oldSlugs = [
  'famous-agency-30m-micro-workers-ogapay',
  'top-5-online-jobs-students-nigeria',
  'hilda-baci-personal-brand-money-lessons',
];

const posts = [
  {
    title: 'Ogapay Tasks: How to Earn Money Completing Micro-Tasks Online',
    slug: 'ogapay-tasks-earn-money-micro-tasks',
    excerpt: 'Ogapay Tasks is Nigeria\'s #1 microtask marketplace. Learn how to browse tasks, complete them, and get paid instantly — no experience required.',
    category: 'Guides',
    tags: JSON.stringify(['tasks', 'microtask', 'earn money', 'beginners', 'Ogapay']),
    coverColor: '#191C6B',
    content: `<h2>What is Ogapay Tasks?</h2>
<p>Ogapay Tasks is Nigeria's #1 microtask marketplace. It connects businesses and individuals ("Posters") with thousands of workers who complete small online tasks for payment. Think of it as a digital marketplace where your time and effort translate directly into income.</p>

<h2>How It Works</h2>
<ol>
<li><strong>Browse Tasks:</strong> Log in and explore tasks across 10+ categories — Social Media, Writing, Design, App Testing, Research, Development, Surveys, Data Entry, Video, and Custom tasks.</li>
<li><strong>Apply & Complete:</strong> Pick a task that matches your skills, follow the instructions, and complete the work.</li>
<li><strong>Submit Proof:</strong> Upload screenshots, links, or files showing your completed work.</li>
<li><strong>Get Paid:</strong> Once the poster approves your submission, the payment is released instantly to your Ogapay wallet.</li>
</ol>

<h2>Task Categories</h2>
<ul>
<li><strong>Social Tasks:</strong> Follow accounts, like posts, comment, share content on X (Twitter), Instagram, Telegram, YouTube, and TikTok.</li>
<li><strong>Writing:</strong> Blog posts, copywriting, translations, SEO content, articles.</li>
<li><strong>Design:</strong> Graphic design, UI/UX, logo design, video editing, thumbnails.</li>
<li><strong>App Testing:</strong> QA testing, bug reporting, beta testing for apps and websites.</li>
<li><strong>Research:</strong> Web research, data collection, market analysis, lead generation.</li>
<li><strong>Development:</strong> Smart contracts, frontend/backend development, bots, API integration.</li>
<li><strong>Quick Tasks:</strong> Pre-configured templates for X Follows, Telegram Joins, YouTube Likes, IG Follows — instant tasks you can complete in seconds.</li>
</ul>

<h2>Why Use Ogapay Tasks?</h2>
<ul>
<li><strong>No experience required:</strong> Start with simple social tasks and work your way up.</li>
<li><strong>Instant payments:</strong> Get paid immediately upon approval — no waiting for payday.</li>
<li><strong>Flexible schedule:</strong> Work whenever and wherever you want. No boss, no shift.</li>
<li><strong>Build skills:</strong> Level up from simple tasks to high-paying specialized work.</li>
<li><strong>Escrow protection:</strong> Your payment is secured in escrow before you start working.</li>
</ul>

<h2>Quick Tasks: Earn in Seconds</h2>
<p>Quick Tasks are pre-made micro-tasks that take just seconds to complete. Follow an X account, join a Telegram group, or like a YouTube video — each task pays instantly. It's the fastest way to start earning on Ogapay.</p>

<h2>For Businesses: Post Tasks and Scale</h2>
<p>If you're a business owner, creator, or marketer, you can post tasks on Ogapay to get work done at scale. Need 1,000 people to follow your new Instagram account? Want 500 reviews for your app? Ogapay Tasks makes it happen. You set the budget, define the instructions, and workers complete the rest.</p>`,
  },
  {
    title: 'Ogapay Wallet: Your Multi-Currency Digital Wallet Explained',
    slug: 'ogapay-wallet-multi-currency-guide',
    excerpt: 'The Ogapay wallet lets you hold, send, and receive money in Naira, USDC, and Solana. Here\'s everything you need to know about managing your funds.',
    category: 'Guides',
    tags: JSON.stringify(['wallet', 'NGN', 'USDC', 'Solana', 'crypto', 'payments', 'Ogapay']),
    coverColor: '#1B6C3C',
    content: `<h2>What is the Ogapay Wallet?</h2>
<p>The Ogapay wallet is your digital financial hub within the platform. It supports multiple currencies — Nigerian Naira (NGN), USDC stablecoin, and Solana (SOL) — giving you the flexibility to earn, save, and transact in the currency that works best for you.</p>

<h2>Wallet Currencies</h2>
<h3>NGN (Naira)</h3>
<p>The primary currency for Nigerian users. All task earnings, referral bonuses, and tips are denominated in Naira by default. You can deposit Naira into your wallet, withdraw to your bank account, and use it to pay for services within the platform.</p>

<h3>USDC (Stablecoin)</h3>
<p>USDC is a stablecoin pegged 1:1 to the US Dollar. It provides a hedge against Naira volatility and allows you to receive payments from international clients without the hassle of currency conversion. USDC in your wallet is always worth exactly $1 USD per token.</p>

<h3>SOL (Solana)</h3>
<p>Solana is a high-performance blockchain that enables fast, low-cost transactions. Holding SOL in your Ogapay wallet opens up access to crypto-based tasks and payments, and positions you for the growing Web3 economy.</p>

<h2>Wallet Features</h2>
<h3>Balance Overview</h3>
<p>Your wallet dashboard shows your available balance, locked balance (funds held in escrow for active tasks), and total earnings across all currencies.</p>

<h3>Transaction History</h3>
<p>Every transaction is recorded and searchable. View your deposits, withdrawals, task payments, referral bonuses, and tips — all in one place with dates, amounts, and status.</p>

<h3>Deposits & Withdrawals</h3>
<p>Add funds to your wallet via bank transfer or crypto deposit. Withdraw your earnings directly to your Nigerian bank account or to your external crypto wallet.</p>

<h2>Why Use the Ogapay Wallet?</h2>
<ul>
<li><strong>All-in-one:</strong> No need for multiple apps. Your earnings, spending, and savings are all in one place.</li>
<li><strong>Multi-currency:</strong> Hold Naira, USDC, and SOL — switch between them as needed.</li>
<li><strong>Instant payments:</strong> Task rewards hit your wallet immediately upon approval.</li>
<li><strong>Track everything:</strong> Full transaction history with filters and search.</li>
<li><strong>Secure:</strong> Industry-standard security with escrow protection for all transactions.</li>
</ul>

<h2>Getting Started</h2>
<p>Your Ogapay wallet is automatically created when you sign up. Start completing tasks to see your balance grow, or deposit funds to begin using the platform as a poster.</p>`,
  },
  {
    title: 'Ogapay Escrow: How Secure Payments Protect Buyers and Sellers',
    slug: 'ogapay-escrow-secure-payments',
    excerpt: 'Every transaction on Ogapay is protected by escrow. Learn how escrow works and why it makes Ogapay the safest platform for online work.',
    category: 'Guides',
    tags: JSON.stringify(['escrow', 'secure payments', 'protection', 'buyer', 'seller', 'Ogapay']),
    coverColor: '#1C3D6B',
    content: `<h2>What is Escrow?</h2>
<p>Escrow is a financial arrangement where a trusted third party holds funds on behalf of two parties in a transaction. On Ogapay, that trusted third party is us. When a poster creates a task, the payment is deposited into escrow before any work begins. The funds are only released to the worker when the poster confirms the work is complete and satisfactory.</p>

<h2>How Escrow Works on Ogapay</h2>
<ol>
<li><strong>Poster creates a task:</strong> They set the reward, define the requirements, and fund the budget.</li>
<li><strong>Funds are locked in escrow:</strong> The full payment amount is held securely by Ogapay.</li>
<li><strong>Worker completes the task:</strong> The worker follows the instructions and submits proof of work.</li>
<li><strong>Poster reviews and approves:</strong> If the work meets the requirements, the poster approves it.</li>
<li><strong>Payment is released:</strong> Funds are instantly transferred from escrow to the worker's wallet.</li>
</ol>

<h2>Why Escrow Matters</h2>
<h3>For Workers</h3>
<ul>
<li><strong>Guaranteed payment:</strong> You never work for free. The money is already set aside before you start.</li>
<li><strong>No risk of non-payment:</strong> Even if the poster disappears, your payment is secure.</li>
<li><strong>Fair treatment:</strong> If there's a dispute, Ogapay's team can review and ensure fair resolution.</li>
</ul>

<h3>For Posters (Businesses)</h3>
<ul>
<li><strong>Pay for results:</strong> You only release payment when you're satisfied with the work.</li>
<li><strong>Quality control:</strong> Workers are motivated to do their best because payment depends on approval.</li>
<li><strong>No upfront risk:</strong> Your funds are safe in escrow until you approve the delivery.</li>
</ul>

<h2>Escrow for Store Purchases</h2>
<p>Escrow protection extends beyond tasks to the Ogapay Store. When you buy a product or service from the Store, your payment is held in escrow until you receive and confirm the delivery. This protects buyers from fraud and ensures sellers get paid for completed work.</p>

<h2>Dispute Resolution</h2>
<p>If a dispute arises, Ogapay's support team steps in to review the evidence — task instructions, submissions, and communications — and make a fair judgment. This ensures that both parties are treated fairly, making Ogapay a trusted platform for all transactions.</p>`,
  },
  {
    title: 'Ogapay Communities: Connect, Learn, and Earn Together',
    slug: 'ogapay-communities-connect-earn',
    excerpt: 'Ogapay Communities bring earners together to share tips, find tasks, and grow together. Join the Nigerian Earners Hub, Web3 Workers Africa, and more.',
    category: 'Guides',
    tags: JSON.stringify(['communities', 'social', 'networking', 'earners', 'Ogapay']),
    coverColor: '#6B1C19',
    content: `<h2>What are Ogapay Communities?</h2>
<p>Ogapay Communities are social groups within the platform where earners connect, share knowledge, discover tasks, and support each other. Think of them as specialized neighborhoods where people with similar interests and goals come together.</p>

<h2>Available Communities</h2>
<ul>
<li><strong>Nigerian Earners Hub:</strong> The main community for all Nigerian earners. Discuss strategies, share winning tips, and celebrate milestones.</li>
<li><strong>Web3 Workers Africa:</strong> For crypto-savvy earners interested in blockchain tasks, Web3 opportunities, and decentralized work.</li>
<li><strong>Design & Creatives NG:</strong> A community for graphic designers, video editors, UI/UX designers, and creative professionals.</li>
</ul>

<h2>Why Join a Community?</h2>
<ul>
<li><strong>Find tasks faster:</strong> Members share newly posted tasks and high-paying opportunities.</li>
<li><strong>Learn from top earners:</strong> Get tips and strategies from the platform's most successful workers.</li>
<li><strong>Networking:</strong> Connect with like-minded people, find collaborators, and build your professional network.</li>
<li><strong>Support:</strong> Get help when you're stuck on a task or need advice on growing your earnings.</li>
<li><strong>Accountability:</strong> Stay motivated by surrounding yourself with ambitious earners.</li>
</ul>

<h2>How to Join</h2>
<p>Browse available communities from your dashboard, read the description, and click "Join." Some communities are open to all members, while others may have specific requirements. Once you're in, introduce yourself and start engaging!</p>

<h2>Community Guidelines</h2>
<p>To keep communities valuable for everyone:</p>
<ul>
<li>Be respectful and professional</li>
<li>Share useful information, not spam</li>
<li>Help others when you can</li>
<li>Follow each community's specific rules</li>
</ul>`,
  },
  {
    title: 'Ogapay Store: Buy and Sell Services in the Marketplace',
    slug: 'ogapay-store-marketplace-services',
    excerpt: 'The Ogapay Store is a full-service marketplace where you can buy and sell digital services. Whether you\'re a designer, writer, or developer, the Store helps you grow.',
    category: 'Guides',
    tags: JSON.stringify(['store', 'marketplace', 'buy services', 'sell services', 'Ogapay']),
    coverColor: '#854F0B',
    content: `<h2>What is the Ogapay Store?</h2>
<p>The Ogapay Store is a service marketplace where users can buy and sell digital products and services. It's like having a storefront on Ogapay where you can showcase your skills — design, writing, marketing, development, and more — and get paid by customers.</p>

<h2>For Buyers</h2>
<p>Need a logo for your business? A social media marketing package? A website? Browse the Store to find skilled sellers offering exactly what you need. Each listing shows the seller's rating, price, delivery time, and reviews from past customers.</p>
<p>Store purchases are protected by Ogapay's escrow system — your payment is held securely until you confirm the delivery meets your expectations.</p>

<h2>For Sellers</h2>
<p>If you have a skill, the Store is your opportunity to monetize it. Create listings for your services, set your prices, and start receiving orders. Benefits include:</p>
<ul>
<li><strong>Built-in audience:</strong> Thousands of active Ogapay users browse the Store daily.</li>
<li><strong>Escrow protection:</strong> Payments are secured so you never work for free.</li>
<li><strong>Seller verification:</strong> Build trust with verified seller status and customer reviews.</li>
<li><strong>Multi-currency pricing:</strong> List your services in Naira, USDC, or SOL.</li>
</ul>

<h2>Store Categories</h2>
<ul>
<li><strong>Design:</strong> Logo design, branding, UI/UX, graphics, video editing</li>
<li><strong>Social Media:</strong> Content creation, account management, campaign setup</li>
<li><strong>Marketing:</strong> SEO, copywriting, email marketing, ad management</li>
<li><strong>Development:</strong> Web development, app development, API integration</li>
<li><strong>Writing:</strong> Blog posts, articles, translations, technical writing</li>
</ul>

<h2>My Store: Manage Your Listings</h2>
<p>Your personal "My Store" page lets you manage all your listings in one place. Add new services, update pricing, track orders, and communicate with customers. It's your command center for selling on Ogapay.</p>`,
  },
  {
    title: 'Ogapay Referral Program: Earn by Inviting Friends',
    slug: 'ogapay-referral-program-earn',
    excerpt: 'Share Ogapay with your friends and earn rewards for every person who joins. Here\'s how the referral program works and how to maximize your earnings.',
    category: 'Guides',
    tags: JSON.stringify(['referral', 'invite friends', 'earn rewards', 'Ogapay']),
    coverColor: '#0F6E56',
    content: `<h2>How the Referral Program Works</h2>
<p>Ogapay's referral program rewards you for inviting new users to the platform. When someone signs up using your unique referral link or code and becomes an active member, you earn a commission directly deposited into your wallet.</p>

<h2>Getting Started</h2>
<ol>
<li><strong>Find your referral code:</strong> Go to your Referrals page in your dashboard to see your unique code and referral link.</li>
<li><strong>Share with friends:</strong> Send your link via WhatsApp, Telegram, Twitter, or any platform. The link format is <code>https://ogapay.app/ref/YOURCODE</code>.</li>
<li><strong>Earn rewards:</strong> When your referral joins and starts earning, you get paid. Simple as that.</li>
</ol>

<h2>Tracking Your Referrals</h2>
<p>Your Referrals dashboard shows:</p>
<ul>
<li><strong>Total referrals:</strong> How many people have joined through your link</li>
<li><strong>Total earnings:</strong> How much you've earned from referrals</li>
<li><strong>Monthly earnings:</strong> Your referral income this month</li>
<li><strong>Referral transactions:</strong> Every referral bonus is tracked in your transaction history</li>
</ul>

<h2>Tips to Maximize Referral Earnings</h2>
<ul>
<li><strong>Share your story:</strong> Tell people how much you're earning on Ogapay. Real results are the best marketing.</li>
<li><strong>Post on social media:</strong> Share your referral link on X (Twitter), Instagram, and WhatsApp status.</li>
<li><strong>Join communities:</strong> Share your link in relevant Telegram and WhatsApp groups (where allowed).</li>
<li><strong>Help your referrals succeed:</strong> The more they earn, the more they'll tell others about Ogapay.</li>
</ul>

<h2>Why Referral Marketing Works</h2>
<p>Performance marketing brings in billions of dollars every year globally. Ogapay's referral program puts this power in your hands. Every person you refer who joins and earns on the platform becomes part of your network, and you benefit from their success.</p>`,
  },
  {
    title: 'Ogapay Vault: Secure Document Storage for Your Important Files',
    slug: 'ogapay-vault-secure-document-storage',
    excerpt: 'The Ogapay Vault lets you securely upload, store, and manage important documents. Keep your IDs, certificates, and business documents safe and accessible.',
    category: 'Guides',
    tags: JSON.stringify(['vault', 'documents', 'storage', 'security', 'KYC', 'Ogapay']),
    coverColor: '#3B6D11',
    content: `<h2>What is the Ogapay Vault?</h2>
<p>The Ogapay Vault is a secure document storage system built into your account. It allows you to upload, organize, and manage important documents — all in one place. Whether it's your government ID, business permit, tax certificate, or portfolio, the Vault keeps your files safe and accessible whenever you need them.</p>

<h2>Key Features</h2>
<ul>
<li><strong>Secure uploads:</strong> All documents are encrypted and stored securely.</li>
<li><strong>Document categories:</strong> Organize files by type — Business Permit, ID Document, KYC Verification, Tax Certificate, Portfolio, and more.</li>
<li><strong>Verification status:</strong> See which documents are verified, pending, or need attention.</li>
<li><strong>Search:</strong> Find any document instantly with the search feature.</li>
<li><strong>Storage tracking:</strong> Monitor your storage usage and document count.</li>
</ul>

<h2>Why Use the Vault?</h2>
<ul>
<li><strong>One place for everything:</strong> No more searching through emails or phone storage for important files.</li>
<li><strong>KYC ready:</strong> Having your ID documents ready in the Vault makes future KYC verification seamless.</li>
<li><strong>Professional:</strong> Showcase verified certificates and qualifications to attract higher-paying tasks.</li>
<li><strong>Always accessible:</strong> Your documents are available whenever you log in to Ogapay.</li>
</ul>

<h2>Document Types</h2>
<ul>
<li>Government-issued ID (National ID, Driver's License, International Passport)</li>
<li>Business Registration / CAC documents</li>
<li>Tax Identification Number (TIN) Certificate</li>
<li>Educational certificates and transcripts</li>
<li>Professional portfolio samples</li>
<li>KYC verification documents</li>
</ul>

<h2>How to Upload</h2>
<p>Navigate to the Vault from your dashboard, click "Upload," select your file, choose the appropriate category, and submit. Documents are reviewed and marked as verified once approved by the Ogapay team.</p>`,
  },
];

async function main() {
  const author = await prisma.user.findUnique({ where: { email: authorEmail } });
  if (!author) {
    console.error('Author not found:', authorEmail);
    process.exit(1);
  }
  console.log(`Author: ${author.firstName} ${author.lastName} (${author.id})`);

  // Delete old adapted posts
  for (const slug of oldSlugs) {
    const existing = await prisma.post.findUnique({ where: { slug } });
    if (existing) {
      await prisma.post.delete({ where: { slug } });
      console.log(`Deleted: ${slug}`);
    }
  }

  // Create new feature explainer posts
  for (const post of posts) {
    const existing = await prisma.post.findUnique({ where: { slug: post.slug } });
    if (existing) {
      console.log(`Skipping (exists): ${post.title}`);
      continue;
    }
    const created = await prisma.post.create({
      data: {
        ...post,
        authorId: author.id,
        publishedAt: new Date(),
      },
    });
    console.log(`Created: ${created.title}`);
  }

  await prisma['$disconnect']();
}

main().catch(e => {
  console.error(e.message);
  prisma['$disconnect']();
  process.exit(1);
});
