const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authorEmail = 'kermitkwif@gmail.com';

const tasks = [
  {
    title: 'Follow @OgaPayHQ on X (Twitter) — Quick Task',
    description: 'Follow the official OgaPay Twitter account @OgaPayHQ. Take a screenshot of your follow as proof. This is a simple social media task that pays instantly.',
    category: 'SOCIAL_MEDIA',
    reward: 150,
    currency: 'NGN',
    maxWorkers: 500,
    instructions: '1. Go to twitter.com/OgaPayHQ\n2. Click the Follow button\n3. Take a screenshot showing you follow\n4. Submit the screenshot as proof',
    tags: ['social', 'twitter', 'follow', 'quick'],
    estimatedTime: 2,
  },
  {
    title: 'Join OgaPay Telegram Community',
    description: 'Join the official OgaPay Telegram group where we share task updates, tips, and community news. Must stay in the group for at least 24 hours.',
    category: 'SOCIAL_MEDIA',
    reward: 200,
    currency: 'NGN',
    maxWorkers: 300,
    instructions: '1. Click the invite link\n2. Join the group\n3. Stay for 24+ hours\n4. Submit your Telegram username as proof',
    tags: ['telegram', 'community', 'social'],
    estimatedTime: 2,
  },
  {
    title: 'Like & Comment on OgaPay Instagram Post',
    description: 'Like the latest OgaPay Instagram post and leave a meaningful comment. Screenshot your like and comment as proof of completion.',
    category: 'SOCIAL_MEDIA',
    reward: 180,
    currency: 'NGN',
    maxWorkers: 200,
    instructions: '1. Go to instagram.com/ogapay\n2. Like the latest post\n3. Leave a comment (e.g. "OgaPay is the best!")\n4. Screenshot and submit',
    tags: ['instagram', 'like', 'comment', 'social'],
    estimatedTime: 3,
  },
  {
    title: 'YouTube: Watch & Subscribe to OgaPay Channel',
    description: 'Subscribe to the OgaPay YouTube channel and watch at least 2 minutes of any video. Submit proof of subscription and watch time.',
    category: 'VIDEO_REVIEW',
    reward: 250,
    currency: 'NGN',
    maxWorkers: 150,
    instructions: '1. Subscribe to OgaPay on YouTube\n2. Watch any video for 2+ minutes\n3. Screenshot showing subscribed status\n4. Submit as proof',
    tags: ['youtube', 'subscribe', 'video', 'social'],
    estimatedTime: 5,
  },
  {
    title: 'Data Entry: List Top 10 Microtask Platforms in Nigeria',
    description: 'Research and list the top 10 microtask platforms available in Nigeria. Include a brief description, payout method, and user rating for each.',
    category: 'DATA_ENTRY',
    reward: 500,
    currency: 'NGN',
    maxWorkers: 50,
    instructions: 'Create a Google Doc or submit a text file with:\n1. Platform name\n2. Website URL\n3. Brief description\n4. Payment method\n5. Your rating (1-5)\nMinimum 200 words total.',
    tags: ['research', 'data', 'list', 'platforms'],
    estimatedTime: 20,
  },
  {
    title: 'Write a 300-Word Review of OgaPay Platform',
    description: 'Write an honest review of your experience using OgaPay. What do you like? What could be improved? Submit as plain text.',
    category: 'CONTENT_WRITING',
    reward: 350,
    currency: 'NGN',
    maxWorkers: 100,
    instructions: 'Write 300+ words about:\n- How you started using OgaPay\n- What features you use most\n- What you like/dislike\n- Suggestions for improvement',
    tags: ['writing', 'review', 'content', 'feedback'],
    estimatedTime: 15,
  },
  {
    title: 'Test OgaPay Mobile App & Report Bugs',
    description: 'Download and test the OgaPay mobile app. Navigate through key features and report any bugs, glitches, or UI issues you find.',
    category: 'APP_TESTING',
    reward: 800,
    currency: 'NGN',
    maxWorkers: 30,
    instructions: '1. Download the OgaPay app\n2. Test: Login, Browse Tasks, Wallet, Profile\n3. Note any bugs or issues\n4. Submit a detailed report with screenshots',
    tags: ['app', 'testing', 'bugs', 'qa', 'mobile'],
    estimatedTime: 30,
  },
  {
    title: 'Design a Social Media Banner for OgaPay',
    description: 'Create a professional social media banner for OgaPay (1200x628 pixels). Use the OgaPay brand colors (deep blue #191C6B and gradient accents).',
    category: 'DESIGN',
    reward: 1500,
    currency: 'NGN',
    maxWorkers: 20,
    instructions: 'Design requirements:\n- Size: 1200x628px\n- Include: OgaPay logo, tagline "Work, Earn → Grow"\n- Brand colors: #191C6B primary\n- Format: PNG/JPG\n- Original work only',
    tags: ['design', 'banner', 'social media', 'graphics'],
    estimatedTime: 45,
  },
  {
    title: 'Complete a 5-Question Market Survey',
    description: 'Answer a short 5-question survey about your online work preferences. Your feedback helps us improve the platform for everyone.',
    category: 'SURVEY',
    reward: 100,
    currency: 'NGN',
    maxWorkers: 1000,
    instructions: 'Answer these questions:\n1. How often do you use OgaPay?\n2. What type of tasks do you prefer?\n3. What reward amount motivates you?\n4. Would you recommend OgaPay to friends?\n5. What feature would you like added?',
    tags: ['survey', 'feedback', 'quick'],
    estimatedTime: 5,
  },
  {
    title: 'Research Web3 Job Opportunities in Africa',
    description: 'Research and compile a list of 5 Web3/blockchain job platforms that are active in Africa. Include details about each platform and the type of work available.',
    category: 'WEB_RESEARCH',
    reward: 600,
    currency: 'NGN',
    maxWorkers: 40,
    instructions: 'For each platform, provide:\n1. Platform name and URL\n2. Types of jobs available\n3. Payment methods\n4. Requirements to start\n5. User reviews/reputation',
    tags: ['research', 'web3', 'blockchain', 'jobs', 'africa'],
    estimatedTime: 25,
  },
  {
    title: 'Translate OgaPay Feature Description to Yoruba',
    description: 'Translate a short feature description from English to Yoruba. Help us make OgaPay more accessible to Yoruba-speaking users across Nigeria.',
    category: 'CONTENT_WRITING',
    reward: 400,
    currency: 'NGN',
    maxWorkers: 25,
    instructions: 'Translate this text to Yoruba:\n"OgaPay is Nigeria\'s #1 microtask marketplace. Complete tasks, earn instant rewards, and grow your income — no special skills required."\nSubmit your translation as plain text.',
    tags: ['translation', 'yoruba', 'content', 'localization'],
    estimatedTime: 10,
  },
  {
    title: 'Create a Short Video Review of OgaPay (30 seconds)',
    description: 'Record a 30-second video sharing your experience with OgaPay. Mention your favorite feature and how much you\'ve earned. Upload to a sharing platform and submit the link.',
    category: 'VIDEO_REVIEW',
    reward: 1000,
    currency: 'NGN',
    maxWorkers: 15,
    instructions: 'Video requirements:\n- 30 seconds max\n- Mention your OgaPay username\n- Share your favorite feature\n- Mention approximate earnings\n- Upload to Google Drive, Dropbox, or YouTube\n- Submit the share link',
    tags: ['video', 'review', 'testimonial', 'content'],
    estimatedTime: 15,
  },
  {
    title: 'Help Test OgaPay Escrow Payment Flow',
    description: 'Test the escrow payment flow by going through a simulated task payment. Report any issues with the payment confirmation or wallet balance updates.',
    category: 'APP_TESTING',
    reward: 1200,
    currency: 'NGN',
    maxWorkers: 10,
    instructions: '1. Go to Wallet page\n2. Check your NGN balance\n3. Navigate to an active task\n4. Note any UI issues\n5. Submit a report with screenshots',
    tags: ['testing', 'escrow', 'payments', 'qa'],
    estimatedTime: 20,
  },
  {
    title: 'Write SEO-Optimized Blog Post Title Ideas for OgaPay',
    description: 'Come up with 10 SEO-optimized blog post title ideas for OgaPay. Each title should target a specific keyword related to microtasks, online earning, or freelancing in Nigeria.',
    category: 'CONTENT_WRITING',
    reward: 300,
    currency: 'NGN',
    maxWorkers: 50,
    instructions: 'Write 10 blog post titles:\n- Each title should include a target keyword\n- Keep titles under 60 characters\n- Make them clickable and engaging\n- Include the target keyword in parentheses',
    tags: ['seo', 'writing', 'content', 'blog', 'keywords'],
    estimatedTime: 15,
  },
  {
    title: 'Verify OgaPay Referral Link Works Correctly',
    description: 'Test the OgaPay referral system by verifying that referral links work correctly. Click your referral link and confirm it redirects to the signup page with your code attached.',
    category: 'APP_TESTING',
    reward: 200,
    currency: 'NGN',
    maxWorkers: 100,
    instructions: '1. Go to your Referrals page\n2. Copy your referral link\n3. Open it in an incognito/private browser\n4. Verify the signup page shows\n5. Screenshot and submit',
    tags: ['testing', 'referral', 'qa', 'link'],
    estimatedTime: 5,
  },
  {
    title: 'Social Media: Follow OgaPay on TikTok',
    description: 'Follow the OgaPay TikTok account and like the 3 most recent videos. Submit screenshots showing your follow and likes.',
    category: 'SOCIAL_MEDIA',
    reward: 160,
    currency: 'NGN',
    maxWorkers: 250,
    instructions: '1. Find @ogapay on TikTok\n2. Follow the account\n3. Like the 3 latest videos\n4. Screenshot proof and submit',
    tags: ['tiktok', 'follow', 'like', 'social'],
    estimatedTime: 3,
  },
];

async function main() {
  const author = await prisma.user.findUnique({ where: { email: authorEmail } });
  if (!author) {
    console.error('Author not found:', authorEmail);
    process.exit(1);
  }
  console.log(`Author: ${author.firstName} ${author.lastName} (${author.id})`);

  let created = 0;
  for (const task of tasks) {
    const slug = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    const existing = await prisma.task.findFirst({
      where: { title: task.title, posterId: author.id },
    });
    if (existing) {
      console.log(`Skipping (exists): ${task.title}`);
      continue;
    }
    const created_task = await prisma.task.create({
      data: {
        ...task,
        posterId: author.id,
        status: 'OPEN',
        deadline,
        currentWorkers: Math.floor(Math.random() * Math.min(task.maxWorkers, 20)),
      },
    });
    console.log(`Created: ${created_task.title} (${created_task.currency} ${created_task.reward})`);
    created++;
  }

  console.log(`\nDone! Created ${created} new tasks.`);
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e.message);
  prisma.$disconnect();
  process.exit(1);
});
