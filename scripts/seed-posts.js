const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authorEmail = 'kermitkwif@gmail.com';

const posts = [
  {
    title: 'Getting Started with Digital Payments in Africa',
    slug: 'getting-started-digital-payments-africa',
    excerpt: 'Discover how digital payments are transforming financial inclusion across Africa and how Ogapay makes it easy for everyone to participate.',
    content: `<h2>The Digital Payment Revolution in Africa</h2>
<p>Africa is experiencing a digital payment revolution. With over 50% of the population under 25 years old and mobile phone penetration exceeding 80% in many countries, the continent is uniquely positioned to leapfrog traditional banking infrastructure.</p>
<blockquote><p>"By 2025, digital payments in Africa are expected to exceed $40 billion annually." — McKinsey Global Institute</p></blockquote>
<h2>Why Digital Payments Matter</h2>
<p>Digital payments offer numerous advantages over traditional cash-based transactions:</p>
<ul>
<li><strong>Financial Inclusion</strong>: Bringing banking services to the unbanked population</li>
<li><strong>Convenience</strong>: Send and receive money instantly from your phone</li>
<li><strong>Security</strong>: Reduced risk of theft compared to carrying cash</li>
<li><strong>Transparency</strong>: Every transaction is recorded and traceable</li>
<li><strong>Lower Costs</strong>: Reduced transaction fees compared to traditional banking</li>
</ul>
<h2>How Ogapay Makes It Easy</h2>
<p>Ogapay was built with the African user in mind. Our platform offers:</p>
<ul>
<li><strong>Instant transfers</strong> to any Nigerian bank account</li>
<li><strong>Virtual Dollar Cards</strong> for international transactions</li>
<li><strong>Bill payments</strong> for utilities, airtime, and data</li>
<li><strong>Escrow services</strong> for secure transactions between parties</li>
</ul>
<p>Getting started is simple — download the app, create an account, and you're ready to transact in minutes.</p>`,
    category: 'Technology',
    tags: ['digital payments', 'Africa', 'fintech', 'financial inclusion'],
    coverColor: '#191C6B',
    status: 'PUBLISHED',
  },
  {
    title: 'Understanding Virtual Dollar Cards: A Complete Guide',
    slug: 'understanding-virtual-dollar-cards-guide',
    excerpt: 'Everything you need to know about virtual dollar cards, how they work, and why they are essential for international transactions.',
    content: `<h2>What is a Virtual Dollar Card?</h2>
<p>A virtual dollar card is a digital payment card that allows you to make online transactions in US Dollars without needing a physical card. It works just like a regular debit card but exists entirely in digital form.</p>
<h2>Why You Need a Virtual Dollar Card</h2>
<p>Whether you're a freelancer, a business owner, or just someone who shops online internationally, a virtual dollar card opens up a world of possibilities:</p>
<ul>
<li><strong>International Shopping</strong>: Pay for subscriptions like Netflix, Spotify, and Amazon</li>
<li><strong>Freelancer Payments</strong>: Receive payments from international clients</li>
<li><strong>Business Expenses</strong>: Pay for SaaS tools, domain names, and hosting</li>
<li><strong>Online Advertising</strong>: Fund Facebook, Google, and TikTok ad accounts</li>
</ul>
<h2>How Ogapay's Virtual Dollar Card Works</h2>
<p>Ogapay offers a seamless virtual dollar card experience:</p>
<ol>
<li><strong>Fund your wallet</strong> with Naira</li>
<li><strong>Create a card</strong> from the dashboard</li>
<li><strong>Set your limits</strong> and start spending</li>
<li><strong>Track transactions</strong> in real-time</li>
</ol>
<p>Our cards are issued in partnership with leading payment processors and are accepted anywhere Visa and Mastercard are accepted.</p>
<h2>Security Features</h2>
<p>Your security is our priority. Each virtual card comes with:</p>
<ul>
<li><strong>CVV</strong> for online transactions</li>
<li><strong>Spending limits</strong> you control</li>
<li><strong>Instant freeze/unfreeze</strong> capability</li>
<li><strong>Real-time notifications</strong> for every transaction</li>
</ul>`,
    category: 'Guides',
    tags: ['virtual dollar card', 'international payments', 'guide', 'fintech'],
    coverColor: '#1B6C3C',
    status: 'PUBLISHED',
  },
  {
    title: '5 Tips for Freelancers to Get Paid Faster',
    slug: 'tips-freelancers-get-paid-faster',
    excerpt: 'Struggling with late payments? Here are five proven strategies Nigerian freelancers can use to get paid faster and more reliably.',
    content: `<h2>The Freelancer's Payment Challenge</h2>
<p>One of the biggest challenges freelancers face is getting paid on time. Whether you're working with local or international clients, payment delays can disrupt your cash flow and cause unnecessary stress.</p>
<h2>1. Use Escrow Services</h2>
<p>Escrow services protect both you and your client. The client deposits funds into a secure account, and the funds are released when you deliver the work. This ensures peace of mind for both parties.</p>
<p>Ogapay's escrow service makes this easy — create an escrow transaction, share the link with your client, and get paid automatically upon delivery.</p>
<h2>2. Set Clear Payment Terms</h2>
<p>Always establish payment terms before starting work. Include:</p>
<ul>
<li><strong>Payment amount</strong> and currency</li>
<li><strong>Due date</strong> (e.g., "Net 15" or "Net 30")</li>
<li><strong>Late payment penalties</strong></li>
<li><strong>Milestone payments</strong> for larger projects</li>
</ul>
<h2>3. Invoice Immediately</h2>
<p>Send your invoice the moment you deliver the work. The faster you invoice, the faster you get paid. Use professional invoicing tools and include all necessary details.</p>
<h2>4. Offer Multiple Payment Options</h2>
<p>Make it easy for clients to pay you. Offer options like:</p>
<ul>
<li><strong>Bank transfers</strong> (local)</li>
<li><strong>Virtual dollar cards</strong> (international)</li>
<li><strong>Direct wallet transfers</strong> for Ogapay users</li>
</ul>
<h2>5. Build Relationships</h2>
<p>Long-term clients who trust you are much more likely to pay on time. Communicate regularly, deliver quality work, and maintain professionalism.</p>`,
    category: 'Finance',
    tags: ['freelancing', 'payments', 'tips', 'escrow', 'Nigerian freelancers'],
    coverColor: '#6B1C19',
    status: 'PUBLISHED',
  },
  {
    title: 'What is Escrow and How Does It Protect Your Transactions?',
    slug: 'what-is-escrow-how-it-protects-transactions',
    excerpt: 'Learn how escrow services work and why they are the safest way to handle high-value transactions between parties who don\'t know each other.',
    content: `<h2>Understanding Escrow</h2>
<p>Escrow is a financial arrangement where a third party holds and regulates payment of funds required for two parties involved in a transaction. It helps make transactions more secure by keeping the payment in a secure account until both parties fulfill their obligations.</p>
<h2>How Escrow Works</h2>
<ol>
<li><strong>Agreement</strong>: Buyer and seller agree on terms (price, delivery date, etc.)</li>
<li><strong>Deposit</strong>: Buyer deposits funds into the escrow account</li>
<li><strong>Delivery</strong>: Seller delivers the product or service</li>
<li><strong>Confirmation</strong>: Buyer confirms receipt and satisfaction</li>
<li><strong>Release</strong>: Funds are released to the seller</li>
</ol>
<h2>Benefits of Using Escrow</h2>
<ul>
<li><strong>For Buyers</strong>: You don't pay until you're satisfied with what you receive</li>
<li><strong>For Sellers</strong>: You know the funds are secure before you deliver</li>
<li><strong>Dispute Resolution</strong>: Neutral third party can help resolve issues</li>
<li><strong>Fraud Protection</strong>: Reduces risk of scams and chargebacks</li>
</ul>
<h2>When to Use Escrow</h2>
<p>Escrow is ideal for:</p>
<ul>
<li>Freelance projects and contract work</li>
<li>Buying and selling goods online</li>
<li>Real estate transactions</li>
<li>Business acquisitions</li>
<li>Domain name sales</li>
</ul>
<h2>Ogapay Escrow</h2>
<p>Ogapay offers a built-in escrow service that makes it easy to create secure transactions. Simply create an escrow from your dashboard, invite the other party, and let Ogapay handle the rest.</p>`,
    category: 'Guides',
    tags: ['escrow', 'secure payments', 'fraud protection', 'online transactions'],
    coverColor: '#1C3D6B',
    status: 'PUBLISHED',
  },
];

async function main() {
  const author = await prisma.user.findUnique({ where: { email: authorEmail } });
  if (!author) {
    console.error('Author not found:', authorEmail);
    return;
  }
  console.log(`Author: ${author.firstName} ${author.lastName} (${author.id})`);

  for (const post of posts) {
    const existing = await prisma.post.findUnique({ where: { slug: post.slug } });
    if (existing) {
      console.log(`Skipping (exists): ${post.title}`);
      continue;
    }
    const created = await prisma.post.create({
      data: {
        ...post,
        tags: JSON.stringify(post.tags),
        authorId: author.id,
        publishedAt: new Date(),
      },
    });
    console.log(`Created: ${created.title}`);
  }

  await prisma['$disconnect']();
}

main().catch(e => {
  console.error(e);
  prisma['$disconnect']();
});
