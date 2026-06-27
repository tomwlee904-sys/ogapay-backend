const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authorEmail = 'kermitkwif@gmail.com';

const posts = [
  {
    title: 'Ogapay Leaderboard & Tiers: How to Level Up and Earn More',
    slug: 'ogapay-leaderboard-tiers-level-up',
    excerpt: 'Ogapay\'s leaderboard and tier system rewards your hard work. Learn how to climb the ranks from Starter to OgaBoss and unlock more earning potential.',
    category: 'Guides',
    tags: JSON.stringify(['leaderboard', 'tiers', 'ranking', 'achievements', 'gamification', 'Ogapay']),
    coverColor: '#191C6B',
    content: `<h2>What is the Ogapay Leaderboard?</h2>
<p>The Ogapay Leaderboard is a gamified ranking system that tracks and rewards your performance on the platform. It ranks users across four categories: <strong>Top Earners</strong>, <strong>Top Task Posters</strong>, <strong>Top Referrers</strong>, and <strong>Community Leaders</strong>.</p>

<h2>Leaderboard Periods</h2>
<p>You can view rankings across three timeframes:</p>
<ul>
<li><strong>Weekly:</strong> Who's been crushing it this week</li>
<li><strong>Monthly:</strong> The top performers of the month</li>
<li><strong>All Time:</strong> The legends of Ogapay</li>
</ul>

<h2>Achievement Badges</h2>
<p>Earn badges as you hit milestones and display them on your profile:</p>
<ul>
<li><strong>Gold Earner</strong> — Earned ₦100,000+ total</li>
<li><strong>Silver Earner</strong> — Earned ₦50,000+ total</li>
<li><strong>Bronze Earner</strong> — Earned ₦25,000+ total</li>
<li><strong>Top Referrer</strong> — Referred the most users</li>
<li><strong>Fast Worker</strong> — Completed tasks with the highest speed and approval rate</li>
<li><strong>Community Leader</strong> — Most active and helpful community member</li>
</ul>

<h2>The Tier System: Starter to OgaBoss</h2>
<p>As you complete more tasks, you progress through tiers that unlock new opportunities:</p>
<ul>
<li><strong>Starter:</strong> Just joined — learning the ropes</li>
<li><strong>Hustler:</strong> Getting consistent — regular task completer</li>
<li><strong>Earner:</strong> Proven track record — access to higher-paying tasks</li>
<li><strong>Pro:</strong> Top performer — priority access and exclusive opportunities</li>
<li><strong>OgaBoss:</strong> The highest tier — platform elite with maximum earning potential</li>
</ul>

<h2>Why It Matters</h2>
<ul>
<li><strong>Higher tiers unlock better tasks:</strong> Posters can filter for higher-tier workers, so top earners get first pick of premium tasks.</li>
<li><strong>Visibility:</strong> Leaderboard rankings and badges appear on your profile, building trust with posters.</li>
<li><strong>Motivation:</strong> Friendly competition keeps you engaged and earning.</li>
<li><strong>Recognition:</strong> Get the credit you deserve for being a top contributor to the Ogapay ecosystem.</li>
</ul>

<h2>How to Climb the Ranks</h2>
<ul>
<li>Complete tasks consistently and accurately</li>
<li>Maintain a high approval rate</li>
<li>Refer new users who become active earners</li>
<li>Be active in Communities — help others and share knowledge</li>
<li>Post quality tasks if you're a business user</li>
</ul>`,
  },
  {
    title: 'Ogapay Campaigns: Run Multi-Platform Marketing Campaigns',
    slug: 'ogapay-campaigns-marketing',
    excerpt: 'Reach thousands of users across X (Twitter), Instagram, Telegram, and more with Ogapay Campaigns. Here\'s how to create and manage your marketing campaigns.',
    category: 'Guides',
    tags: JSON.stringify(['campaigns', 'marketing', 'social media', 'promotion', 'X', 'Instagram', 'Telegram', 'Ogapay']),
    coverColor: '#993556',
    content: `<h2>What are Ogapay Campaigns?</h2>
<p>Ogapay Campaigns is a powerful marketing tool that lets you run multi-platform promotion campaigns. Whether you're an artist promoting a new track, a brand launching a product, or a business building awareness, Campaigns puts thousands of Ogapay workers behind your marketing efforts.</p>

<h2>How It Works</h2>
<ol>
<li><strong>Create a campaign:</strong> Choose your target platforms — X (Twitter), Instagram, Telegram, or all three.</li>
<li><strong>Set your budget:</strong> Define how much you want to spend and per-action rewards.</li>
<li><strong>Define actions:</strong> Specify what workers should do — follow, like, comment, share, or create content.</li>
<li><strong>Launch and track:</strong> Watch your campaign metrics in real-time: reach, engagements, and budget usage.</li>
</ol>

<h2>Campaign Types</h2>
<h3>Social Media Engagement</h3>
<p>Grow your presence on X (Twitter), Instagram, and Telegram. Set up tasks for follows, likes, comments, reposts, and shares. Perfect for building social proof and algorithmic momentum.</p>

<h3>Content Amplification</h3>
<p>Need a post to go viral? Use Campaigns to get hundreds of real users engaging with your content immediately after publishing. This signals to the algorithm that your content is valuable, boosting organic reach.</p>

<h3>Music & Content Promotion</h3>
<p>Artists and creators can launch campaigns to drive streams, shares, and engagement on new releases. Get your track trending on social media from day one.</p>

<h2>Managing Your Campaigns</h2>
<p>Your Campaigns dashboard gives you full control:</p>
<ul>
<li><strong>Status management:</strong> Pause, resume, or end campaigns at any time</li>
<li><strong>Budget tracking:</strong> See exactly how much you've spent and remaining budget</li>
<li><strong>Performance metrics:</strong> Reach, engagements, cost per engagement</li>
<li><strong>Campaign history:</strong> Review past campaigns and their results</li>
</ul>

<h2>Why Use Ogapay Campaigns?</h2>
<ul>
<li><strong>Real users, real engagement:</strong> No bots — every action comes from verified Ogapay workers</li>
<li><strong>Cost-effective:</strong> Pay only for completed actions, not impressions</li>
<li><strong>Multi-platform:</strong> One campaign, multiple platforms</li>
<li><strong>Scalable:</strong> Start small and scale up based on results</li>
<li><strong>Track everything:</strong> Detailed analytics for every campaign</li>
</ul>`,
  },
  {
    title: 'Ogapay Messaging: How In-App Chat Works for Workers and Posters',
    slug: 'ogapay-messaging-in-app-chat',
    excerpt: 'Communicate directly with task posters, collaborators, and community members using Ogapay\'s built-in messaging system.',
    category: 'Guides',
    tags: JSON.stringify(['messaging', 'chat', 'communication', 'in-app', 'Ogapay']),
    coverColor: '#1C3D6B',
    content: `<h2>What is Ogapay Messaging?</h2>
<p>Ogapay's in-app messaging system lets you communicate directly with other users — task posters, workers, community members, and collaborators — without leaving the platform. No need to share phone numbers or email addresses.</p>

<h2>Key Features</h2>
<h3>Conversations</h3>
<p>All your chats are organized in a clean inbox. Each conversation shows the last message preview, so you can quickly catch up. Unread messages are clearly marked with a badge count.</p>

<h3>Real-Time Updates</h3>
<p>New messages are delivered in real-time. The system checks for new messages every few seconds, so you never miss an important update about your tasks or collaborations.</p>

<h3>Search Conversations</h3>
<p>Can't find a specific chat? Use the search feature to quickly find any conversation by user name or message content.</p>

<h3>Start New Chats</h3>
<p>Need to reach someone new? Use the recipient search with autocomplete to find any Ogapay user and start a conversation.</p>

<h2>When to Use Messaging</h2>
<ul>
<li><strong>Clarify task requirements:</strong> Ask the poster questions before starting a task</li>
<li><strong>Submit additional info:</strong> Share extra context or files after submitting your work</li>
<li><strong>Negotiate custom work:</strong> Discuss larger projects outside the standard task system</li>
<li><strong>Collaborate with other workers:</strong> Team up on complex tasks</li>
<li><strong>Community networking:</strong> Build relationships with fellow earners</li>
</ul>

<h2>Best Practices</h2>
<ul>
<li><strong>Be professional:</strong> Clear communication leads to better outcomes and repeat work</li>
<li><strong>Keep task discussions in the platform:</strong> Ogapay can only protect you for communications within the app</li>
<li><strong>Respond promptly:</strong> Quick replies build trust with posters and collaborators</li>
<li><strong>Report issues:</strong> If someone is harassing you or acting unprofessionally, report them to support</li>
</ul>`,
  },
  {
    title: 'Ogapay Developer API: Build on Top of the Ogapay Platform',
    slug: 'ogapay-developer-api-guide',
    excerpt: 'Integrate your applications with Ogapay using our REST API. Access tasks, authentication, communities, and wallet endpoints to build powerful integrations.',
    category: 'Technology',
    tags: JSON.stringify(['API', 'developer', 'integration', 'REST', 'automation', 'Ogapay']),
    coverColor: '#1B6C3C',
    content: `<h2>What is the Ogapay Developer API?</h2>
<p>The Ogapay Developer API is a RESTful API that allows developers to build applications and integrations on top of the Ogapay platform. Whether you want to automate task management, query community data, or integrate wallet functionality into your own app, the API makes it possible.</p>

<h2>Available Endpoints</h2>
<h3>Authentication</h3>
<p>Securely authenticate users and manage sessions. Generate access tokens for authorized API calls.</p>

<h3>Tasks</h3>
<p>Programmatically create, read, and manage tasks. Automate task posting, retrieve task listings, and track completion status.</p>

<h3>Communities</h3>
<p>Access community data — list communities, get member counts, and retrieve community details for integration into your applications.</p>

<h3>Wallet</h3>
<p>Check wallet balances, view transaction history, and manage funds programmatically.</p>

<h2>Authentication</h2>
<p>The API uses Bearer token authentication. Include your access token in the <code>Authorization</code> header of each request:</p>
<pre>GET /api/v1/wallet/balance
Authorization: Bearer your_access_token_here</pre>

<h2>Code Examples</h2>
<h3>cURL</h3>
<pre>curl -H "Authorization: Bearer token" https://ogapay-production.up.railway.app/api/v1/wallet/balance</pre>

<h3>JavaScript</h3>
<pre>fetch('https://ogapay-production.up.railway.app/api/v1/tasks', {
  headers: { 'Authorization': 'Bearer ' + token }
}).then(r => r.json()).then(console.log)</pre>

<h3>Python</h3>
<pre>import requests
headers = {'Authorization': 'Bearer ' + token}
r = requests.get('https://ogapay-production.up.railway.app/api/v1/communities', headers=headers)
print(r.json())</pre>

<h2>Why Build on Ogapay?</h2>
<ul>
<li><strong>Access a growing user base:</strong> Integrate with thousands of active earners</li>
<li><strong>Automate workflows:</strong> Save time by automating task posting and management</li>
<li><strong>Build custom tools:</strong> Create dashboards, analytics tools, or specialized interfaces</li>
<li><strong>Documentation:</strong> Developer docs are available to help you get started quickly</li>
</ul>

<h2>Getting Started</h2>
<p>Visit the Developer API section in your dashboard to get your API credentials and explore the full documentation.</p>`,
  },
];

async function main() {
  const author = await prisma.user.findUnique({ where: { email: authorEmail } });
  if (!author) {
    console.error('Author not found:', authorEmail);
    process.exit(1);
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
