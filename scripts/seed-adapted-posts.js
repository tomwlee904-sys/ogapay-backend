const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authorEmail = 'kermitkwif@gmail.com';

const posts = [
  {
    title: 'How This Agency Built a ₦30M/Year Business Using Ogapay Micro-Workers',
    slug: 'famous-agency-30m-micro-workers-ogapay',
    excerpt: 'Famous Mallam went from engineering student to running a ₦30M/year digital marketing agency. Here\'s how he used Ogapay\'s micro-worker marketplace to scale.',
    category: 'Case Studies',
    tags: JSON.stringify(['micro-workers', 'digital agency', 'case study', 'social media marketing', 'scaling business']),
    coverColor: '#191C6B',
    status: 'PUBLISHED',
    content: `<h2>From Engineering Student to Agency Owner</h2>
<p>What's up! I'm Famous Mallam, the brain behind Famous Agency, one of Nigeria's fastest-growing digital marketing agencies. We're the magicians behind those viral social media campaigns you've been seeing for your favorite musicians, politicians, and top businesses.</p>
<p>Every month, we help over 5 high-profile clients dominate social media. We also manage a network of 300-500 digital micro-workers who work behind the scenes to make content go viral. And get this - we're now pulling in between ₦3.5M and ₦5M monthly! Not bad for someone who started out studying engineering, right?</p>

<h2>How It All Started</h2>
<p>My story isn't your typical "I've always known what I wanted to do" tale. I was neck-deep in engineering books, preparing for a future in the oil and gas industry, when the digital marketing bug bit me. Sometimes, your true calling doesn't care about your degree!</p>
<p>My first attempts were rough, sha. I started by managing small WhatsApp and Telegram groups for campaigns. It was chaotic - like trying to direct Lagos traffic without LASTMA. I had to figure out everything on my own, learning from trial and error while earning peanuts.</p>
<p>The turning point came in 2022. I discovered Ogapay, a platform that connects businesses with thousands of micro-workers who help with tasks like sharing content, boosting engagement, and more. That discovery changed everything. Instead of managing multiple WhatsApp groups like a street performer, I could now scale my efforts effortlessly.</p>

<h2>The Business Model</h2>
<h3>Premium Packages</h3>
<p>We offer premium social media marketing packages starting at $500 (about ₦400,000). These are all-inclusive services: from trend-setting tweets to Instagram content that feels like a celeb hangout spot. No shortcuts here - we deliver results that get people talking.</p>

<h3>For Musicians</h3>
<p>We specialize in blowing up new tracks. Picture this: your song drops at midnight, and by morning, it's all over Twitter trends, Instagram reels, and TikTok challenges. When Nigeria wakes up, your track is what they're vibing to.</p>

<h3>The Secret Sauce</h3>
<p>Our "secret" is no secret at all: the 300-500 micro-workers on our job list managed through Ogapay. These are the real MVPs, handling content sharing, engagement boosting, and everything else needed to make a campaign successful.</p>

<h2>What's Working to Keep the Business Growing</h2>
<p>First things first - no shortcuts! When you're running campaigns for A-list celebrities, politicians, and top brands, you can't afford to slack. We've built our reputation on quality and consistency, and that's why clients keep coming back.</p>
<ul>
<li><strong>Premium Pricing:</strong> We charge a minimum of ₦400,000 per campaign. This attracts serious clients who understand value.</li>
<li><strong>Custom Tools:</strong> We've invested in building tools that help us deliver faster and better results.</li>
<li><strong>Scaling Operations:</strong> Ogapay's platform allows us to scale campaigns effortlessly, handling more clients without compromising quality.</li>
<li><strong>Consistency:</strong> Whether it's a small campaign or a nationwide trend, we deliver on time, every time.</li>
</ul>
<p>But of course, it's not always smooth sailing. Managing client expectations is no joke, especially with high-profile personalities. As we say in Lagos, "pressure makes diamonds!"</p>

<h2>Advice for Others Starting Out</h2>
<p>If you're reading this and thinking about diving into the digital marketing game, here are a few things I've learned along the way:</p>
<ul>
<li><strong>Success takes time:</strong> Forget those "get rich quick" stories. It's a marathon, not a sprint.</li>
<li><strong>Start small:</strong> You don't need fancy tools to start. I began with just WhatsApp groups and my phone.</li>
<li><strong>Invest in good tools:</strong> As you grow, leverage platforms like Ogapay, Canva, and ChatGPT to streamline your work and scale.</li>
<li><strong>Build your reputation:</strong> One satisfied client can bring you ten more. Focus on delivering value and let word of mouth work for you.</li>
</ul>

<h2>What's Next?</h2>
<p>The future is looking bright! We're scaling up, taking on bigger clients, and exploring new ways to dominate the digital space. We're also doubling down on helping musicians and brands make a splash on platforms like TikTok, Instagram, and Twitter.</p>
<p>If you're an upcoming entrepreneur or a creative looking to grow, I hope my story inspires you to take that leap. Whether you're in engineering, law, or any other field, don't be afraid to pivot when you find your true calling.</p>
<p>The hustle is real, but the rewards are worth it. Keep pushing, keep learning, and remember: the journey is just as important as the destination.</p>`,
  },
  {
    title: 'Top 5 Online Jobs for Students to Earn Money in Nigeria',
    slug: 'top-5-online-jobs-students-nigeria',
    excerpt: 'Looking for legitimate online work as a student in Nigeria? Here are five proven ways to earn money online, from micro-jobs to building your own digital agency.',
    category: 'How To',
    tags: JSON.stringify(['students', 'online jobs', 'side hustle', 'micro-jobs', 'Nigeria', 'earn money online']),
    coverColor: '#1B6C3C',
    status: 'PUBLISHED',
    content: `<p>In today's digital age, the internet has opened up countless opportunities for students to earn money online. From micro-jobs to affiliate marketing, social media marketing, and even running a full-fledged digital marketing agency, there's something for everyone. Here are five proven ways to get started.</p>

<h2>1. Micro-Jobs: The Effortless Entry Point</h2>
<p>Micro-jobs are an excellent way to dip your toes into online earning. These tasks are typically straightforward, requiring minimal skills - just a device and an internet connection. Platforms like Ogapay connect you with businesses that need help with tasks like content sharing, reviews, social media engagement, and more.</p>
<p>To get started with micro-jobs, simply create an account on Ogapay, browse available tasks, and start completing them. Each completed task earns you money directly in your wallet. It's the easiest way to generate income while gaining experience in the online workspace.</p>

<h2>2. Social Media Management</h2>
<p>As you progress, social media marketing becomes an essential skill to develop. This involves handling social media campaigns for brands and individuals who want to enhance their online presence.</p>
<p>Social media management requires proficiency in design and branding, leveraging tools like Canva to create visually appealing content. You'll need to understand the intricacies of each platform and tailor your strategies to their unique algorithms.</p>
<p>Tips to excel:</p>
<ul>
<li>Develop a strong, consistent brand voice</li>
<li>Plan and schedule content in advance</li>
<li>Engage genuinely with your audience</li>
<li>Analyze performance metrics and refine your approach</li>
</ul>

<h2>3. Affiliate Marketing</h2>
<p>Affiliate marketing involves promoting products or services and earning a commission for each sale you facilitate. This presents immense scaling opportunities, especially when you combine an in-demand product with targeted traffic and an effective sales strategy.</p>
<p>With Ogapay's growing marketplace, you can promote products and services to a wide audience. To excel:</p>
<ul>
<li><strong>Understand your audience:</strong> Research their needs and buying behaviors</li>
<li><strong>Build trust:</strong> Provide valuable content and honest reviews</li>
<li><strong>Tell stories:</strong> Craft compelling narratives around the products you promote</li>
<li><strong>Optimize continuously:</strong> Refine your approach based on what works</li>
</ul>

<h2>4. Content Creation & UGC</h2>
<p>User-Generated Content (UGC) creation is one of the hottest opportunities right now. Brands are eager to pay creators who can produce authentic content that resonates with their target audience. If you have a knack for creating engaging content on TikTok or Instagram, this could be your path.</p>
<p>Key elements of viral content:</p>
<ul>
<li>Identify a specific pain point or desire for your audience</li>
<li>Promise a tangible outcome or transformation</li>
<li>Evoke emotion with your storytelling</li>
<li>Be specific with your advice and examples</li>
<li>Create urgency or highlight timeliness</li>
</ul>

<h2>5. Start Your Own Digital Agency</h2>
<p>As your skills in sales, social media, and branding grow, you can establish your own digital marketing agency. This entrepreneurial path lets you leverage your expertise and offer comprehensive services to clients across various industries.</p>
<p>Running a successful digital agency requires:</p>
<ul>
<li>Client acquisition and relationship management</li>
<li>Project management and team coordination</li>
<li>Data-driven analytics and reporting</li>
<li>Continuous learning of emerging trends</li>
</ul>

<h2>Getting Started with Ogapay</h2>
<p>Ogapay makes it easy to start your online earning journey. Whether you're completing micro-tasks in our Tasks marketplace, promoting products through our platform, or using our wallet and virtual dollar cards to manage your earnings, everything you need is in one place.</p>
<p>Remember, every journey begins with a single step. Start with micro-jobs, build your skills, and gradually explore bigger opportunities. The world of online earning is yours to conquer.</p>`,
  },
  {
    title: 'How Hilda Baci Built a Money-Making Personal Brand That Went Global',
    slug: 'hilda-baci-personal-brand-money-lessons',
    excerpt: 'From breaking two Guinness World Records to building a profitable personal brand, Hilda Baci\'s journey offers powerful lessons for every creator and entrepreneur.',
    category: 'Case Studies',
    tags: JSON.stringify(['Hilda Baci', 'personal branding', 'case study', 'creator economy', 'entrepreneurship']),
    coverColor: '#993556',
    status: 'PUBLISHED',
    content: `<p>For many years, there has been a heated debate on which Jollof rice tastes better in Africa. Nigeria Jollof or Ghana Jollof? On September 13, Hilda Baci put an end to this debate by cooking the world's largest pot of Jollof rice. (Sorry Ghana!)</p>
<p>But this post isn't about food. It's about how Hilda Baci proved that you can change your career by being audacious while being great at what you do. From breaking two Guinness World Records to selling digital products and turning brand collaborations into viral moments, she showed that with the right mix of visibility, strategy, and community support, anything is possible.</p>

<h2>The First Record: The Cook-a-Thon</h2>
<p>In 2023, Hilda announced her attempt to break the Guinness World Record for the longest cooking marathon. She titled it "The Cook-a-thon." The announcement was met with mixed reactions - some supported, others criticized. Think about it: cooking for over 93 hours with no real sleep, just endless chopping, frying, and stirring.</p>
<p>But to Hilda and her team, it wasn't just about the food. It was about audacity, attention, resilience, and storytelling.</p>
<p>On May 11, 2023, the event started slow. But Hilda did something most wouldn't think of - she streamed everything live. With every hour, followers joined the livestream, and tweets circulated across Twitter. By the second day, the support was overwhelming.</p>
<p>From Lagos to London, from Instagram reels to CNN headlines, Hilda became the talk of the internet. Celebrities, politicians, and influencers all wanted to be part of the moment. It was no longer just a Guinness World Record attempt; it was a cultural moment.</p>

<h2>The Genius Move: Turning Attention Into Income</h2>
<p>Here's the genius part: Hilda didn't just bask in the fame. She understood that attention is currency, and if you don't invest it wisely, it fades away.</p>
<p>With millions of fans craving to learn from her, she rolled out digital products - recipe e-books, cooking classes, and more. Her cooking academy, "The Hilda Cooking Academy," was booked with thousands of students in each batch. Registration happens twice a year, and top graduates receive millions of Naira in prizes, phones, and even cars.</p>
<p>Hilda proved that going viral is just step one. The real magic is converting visibility into real value.</p>

<h2>The Second Record: Partnership Power</h2>
<p>In August 2025, Hilda announced a second world record attempt: cooking the largest pot of Jollof rice. This time, she partnered with Gino, a household food brand. The collaboration used 4,000kg of rice, 500 cartons of tomato paste, 600kg of onions, and 168kg of goat meat.</p>
<p>Her community showed up in numbers. Influencers stopped by, live-streaming and creating content that amplified the buzz. Media outlets picked up the story, and brands leveraged the moment.</p>

<h2>5 Lessons for Creators & Entrepreneurs</h2>
<h3>1. Attention Is Currency - Spend It Wisely</h3>
<p>Going viral is not the end goal; it's the beginning. Hilda channeled her momentum into digital products, classes, and brand deals. That's the difference between a viral moment and a lasting brand.</p>

<h3>2. Storytelling Makes You Unforgettable</h3>
<p>Hilda didn't just cook for 100+ hours. She framed it as "The Cook-a-thon" - a live-streamed event with emotional updates and press coverage. She made it an event, not just an activity.</p>

<h3>3. Build a Community, Not Just Followers</h3>
<p>Followers like and scroll past. Communities show up, share, and keep talking. Hilda involved her people in her journey, making them feel part of the story.</p>

<h3>4. Collaboration Opens Doors</h3>
<p>By partnering with Gino, Hilda showed the power of strategic collaboration. Gino brought resources and credibility; Hilda brought influence and audience trust. Together, they created a win-win moment.</p>

<h3>5. Be Audacious</h3>
<p>If Hilda had started another cooking YouTube channel, nobody would be talking about her. Cooking for 100 hours and making the world's largest pot of Jollof rice were audacious ideas that made people stop, talk, argue, support, and share.</p>

<h2>How You Can Apply This</h2>
<p>Hilda's story isn't really about cooking. It's about brand building, visibility, and turning peak moments into business opportunities.</p>
<ul>
<li><strong>Have something ready:</strong> If people are watching, what are you selling? Have a product, service, or offer ready to go.</li>
<li><strong>Build your community:</strong> Make your audience feel part of your story. They'll become your biggest marketers.</li>
<li><strong>Collaborate strategically:</strong> The right partnership can create a wave that puts you on a bigger stage.</li>
<li><strong>Be bold:</strong> Playing small keeps you safe but invisible. Audacious moves cut through the noise.</li>
</ul>
<p>Whether you're selling products or sharing your art, the world rewards those who are bold enough to put themselves out there and smart enough to turn the spotlight into something lasting.</p>`,
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
