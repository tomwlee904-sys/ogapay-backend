'use strict';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/index');
const { prisma } = require('../src/config/database');

const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';
const print = (label, ok, detail = '') => console.log(`  [${ok ? PASS : FAIL}] ${label}${detail ? ' — ' + detail : ''}`);

let sellerToken, buyerToken, sellerId, buyerId;
let productId, productImageUrl;
let purchaseId;

async function cleanup() {
  const testUsers = await prisma.user.findMany({
    where: { email: { contains: '@store-e2e.com' } },
    select: { id: true },
  });
  const userIds = testUsers.map(u => u.id);
  if (userIds.length > 0) {
    const tasks = await prisma.task.findMany({ where: { posterId: { in: userIds } }, select: { id: true } });
    const taskIds = tasks.map(t => t.id);
    if (taskIds.length > 0) {
      await prisma.taskSubmission.deleteMany({ where: { taskId: { in: taskIds } } });
      await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    }
    const storeItems = await prisma.storeItem.findMany({ where: { sellerId: { in: userIds } }, select: { id: true } });
    const itemIds = storeItems.map(i => i.id);
    if (itemIds.length > 0) {
      await prisma.storeReview.deleteMany({ where: { itemId: { in: itemIds } } });
      await prisma.storePurchase.deleteMany({ where: { itemId: { in: itemIds } } });
      await prisma.storeItem.deleteMany({ where: { id: { in: itemIds } } });
    }
    await prisma.communityMessage.deleteMany({ where: { senderId: { in: userIds } } });
    await prisma.communityRequest.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.communityMember.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.community.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.storePurchase.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.transaction.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.wallet.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.kycVerification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.workerProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.posterProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

async function main() {
  console.log('\n=== OgaPay Store E2E Test ===\n');

  // ════════════════════════════════════════════
  // PHASE 1: Create test accounts
  // ════════════════════════════════════════════
  console.log('PHASE 1 — Create Test Accounts');

  const ts = Date.now();
  const se = `seller${ts}@store-e2e.com`;
  const be = `buyer${ts}@store-e2e.com`;
  const su = `st_seller_${ts}`.slice(-18);
  const bu = `st_buyer_${ts}`.slice(-17);

  let sellerRes;
  for (let attempt = 0; attempt < 3; attempt++) {
    sellerRes = await request(app)
      .post('/v1/auth/register')
      .send({ email: se, password: 'Test123!', firstName: 'Store', lastName: 'Seller', username: su, role: 'POSTER' });
    if (sellerRes.status === 201) break;
    await new Promise(r => setTimeout(r, 2000));
  }
  print('Seller registration', sellerRes.status === 201, `status=${sellerRes.status}`);
  sellerToken = sellerRes.body?.data?.tokens?.accessToken || sellerRes.body?.data?.session?.accessToken;
  sellerId = sellerRes.body?.data?.user?.id;
  print('Seller token obtained', !!sellerToken);
  print('Seller ID obtained', !!sellerId);

  let buyerRes;
  for (let attempt = 0; attempt < 3; attempt++) {
    buyerRes = await request(app)
      .post('/v1/auth/register')
      .send({ email: be, password: 'Test123!', firstName: 'Store', lastName: 'Buyer', username: bu, role: 'WORKER' });
    if (buyerRes.status === 201) break;
    await new Promise(r => setTimeout(r, 2000));
  }
  print('Buyer registration', buyerRes.status === 201, `status=${buyerRes.status}`);
  buyerToken = buyerRes.body?.data?.tokens?.accessToken || buyerRes.body?.data?.session?.accessToken;
  buyerId = buyerRes.body?.data?.user?.id;
  print('Buyer token obtained', !!buyerToken);
  print('Buyer ID obtained', !!buyerId);

  if (!sellerToken || !buyerToken) {
    console.log('  ⚠ Cannot proceed without valid tokens. Check DB connection.');
  }

  // ════════════════════════════════════════════
  // PHASE 2 — Test product creation
  // ════════════════════════════════════════════
  console.log('\nPHASE 2 — Product Creation');

  const p2Create = await request(app)
    .post('/v1/store/products')
    .set('Authorization', `Bearer ${sellerToken}`)
    .send({
      name: 'E2E Test Design Service',
      description: 'A premium graphic design package tested end-to-end',
      price: 5000,
      currency: 'NGN',
      category: 'DESIGN',
      imageUrl: 'https://picsum.photos/400/300',
      subcategory: 'Social Media Design',
      revisions: 3,
      delivery: '48 hours',
      tags: ['design', 'e2e-test'],
    });
  const p2Ok = p2Create.status === 201;
  print('POST /store/products -> 201', p2Ok, `status=${p2Create.status}`);
  productId = p2Create.body?.data?.id;
  print('Product ID obtained', !!productId);
  if (p2Ok) {
    print('Product status', p2Create.body.data.status === 'DRAFT', `status=${p2Create.body.data.status}`);
    print('Product isActive', p2Create.body.data.isActive === true);
  }

  // ════════════════════════════════════════════
  // PHASE 3 — Test image upload
  // ════════════════════════════════════════════
  console.log('\nPHASE 3 — Image Upload');

  const fs = require('fs');
  const path = require('path');
  const imgPath = path.join(__dirname, '..', 'temp-test-img.png');
  // Create a minimal valid 1x1 PNG pixel (works without canvas library)
  const pngBuf = Buffer.from([
    0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A, // PNG signature
    0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52, // IHDR chunk header
    0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01, // 1x1 pixel
    0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,0xDE, // 8-bit grayscale
    0x00,0x00,0x00,0x0C,0x49,0x44,0x41,0x54, // IDAT chunk header
    0x08,0xD7,0x63,0x60,0x60,0x60,0x00,0x00,0x00,0x04,0x00,0x01,0x27,0x34,0x27,0x0A,
    0x00,0x00,0x00,0x00,0x49,0x45,0x4E,0x44,0xAE,0x42,0x60,0x82, // IEND chunk
  ]);
  fs.writeFileSync(imgPath, pngBuf);
  const fileExists = fs.existsSync(imgPath);
  print('Test image created', fileExists);

  const p3Upload = await request(app)
    .post('/v1/uploads/store')
    .set('Authorization', `Bearer ${sellerToken}`)
    .attach('file', imgPath);
  const p3Ok = p3Upload.status === 201;
  print('POST /uploads/store -> 201', p3Ok, `status=${p3Upload.status}`);
  productImageUrl = p3Upload.body?.data?.url;
  print('Upload returns URL', !!productImageUrl);
  if (productImageUrl) {
    print('URL is persistent (https://)', productImageUrl.startsWith('https://'));
  }
  if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);

  // Create a second product using the uploaded image URL
  if (productImageUrl) {
    const p3b = await request(app)
      .post('/v1/store/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({ name: 'E2E Product with Uploaded Image', description: 'Using uploaded image', price: 3000, currency: 'NGN', category: 'DESIGN', imageUrl: productImageUrl });
    print('Product with uploaded image URL', p3b.status === 201);
    if (p3b.status === 201) {
      print('Image URL saved correctly', p3b.body.data.imageUrl === productImageUrl);
      await prisma.storeItem.delete({ where: { id: p3b.body.data.id } });
    }
  }

  // ════════════════════════════════════════════
  // PHASE 5 — Test product visibility (4 locations)
  // ════════════════════════════════════════════
  console.log('\nPHASE 5 — Product Visibility');

  // 5a: Public store listing
  const p5a = await request(app).get('/v1/store?limit=50');
  const p5aOk = p5a.status === 200;
  print('5a: GET /store -> 200', p5aOk, `status=${p5a.status}`);
  if (p5aOk) {
    const items = p5a.body?.data?.items || [];
    const found = items.find(i => i.id === productId);
    print('Product in public listing', !!found, found ? `title="${found.title}"` : 'NOT FOUND');
    if (found) {
      print('  title field mapped', found.title === 'E2E Test Design Service', `got="${found.title}"`);
      print('  image field present', !!found.image);
      print('  seller name present', !!found.seller);
      print('  price present', found.price > 0);
    }
  }

  // 5b: Seller's my-products
  const p5b = await request(app)
    .get('/v1/store/my-products')
    .set('Authorization', `Bearer ${sellerToken}`);
  const p5bOk = p5b.status === 200;
  print('5b: GET /store/my-products -> 200', p5bOk, `status=${p5b.status}`);
  if (p5bOk) {
    const items = Array.isArray(p5b.body?.data) ? p5b.body.data : [];
    const found = items.find(i => i.id === productId);
    print('Product in my-products', !!found, found ? `name="${found.name}"` : 'NOT FOUND');
  }

  // 5c: Worker profile (buyer is WORKER role, has WorkerProfile)
  const p5c = await request(app).get(`/v1/store/workers/${buyerId}`);
  const p5cOk = p5c.status === 200;
  print('5c: GET /store/workers/:id -> 200', p5cOk, `status=${p5c.status}`);
  if (p5cOk) {
    const d = p5c.body?.data || {};
    print('Product count on profile', d.productCount >= 0, `count=${d.productCount}`);
    print('  verifiedCreator present', typeof d.verifiedCreator === 'boolean');
    print('  moreAbout present', d.moreAbout === null);
    print('  challengesParticipated present', typeof d.challengesParticipated === 'number');
    print('  challengesWon present', typeof d.challengesWon === 'number');
  }

  // 5e: Worker listing includes new fields
  const p5e = await request(app).get(`/v1/store/workers?limit=5`);
  const p5eOk = p5e.status === 200;
  print('5e: GET /store/workers listing -> 200', p5eOk, `status=${p5e.status}`);
  if (p5eOk) {
    const items = Array.isArray(p5e.body?.data) ? p5e.body.data : [];
    if (items.length > 0) {
      const first = items[0];
      print('  verifiedCreator in listing', typeof first.verifiedCreator === 'boolean');
      print('  challengesParticipated in listing', typeof first.challengesParticipated === 'number');
      print('  challengesWon in listing', typeof first.challengesWon === 'number');
    }
  }

  // 5d: Product detail page
  const p5d = await request(app).get(`/v1/store/${productId}`);
  const p5dOk = p5d.status === 200;
  print('5d: GET /store/:id -> 200', p5dOk, `status=${p5d.status}`);
  if (p5dOk) {
    const d = p5d.body?.data || {};
    print('  title populated', d.title === 'E2E Test Design Service');
    print('  description populated', d.description?.length > 0);
    print('  price populated', d.price > 0);
    print('  currency populated', !!d.currency);
    print('  category populated', !!d.category);
    print('  seller name populated', !!d.seller);
    print('  image populated', !!d.image);
  }

  // ════════════════════════════════════════════
  // PHASE 6 — Test AI assistant
  // ════════════════════════════════════════════
  console.log('\nPHASE 6 — AI Assistant');

  const p6Desc = await request(app)
    .post('/v1/ai/generate-description')
    .set('Authorization', `Bearer ${sellerToken}`)
    .send({ name: 'Social Media Package', category: 'DESIGN', keywords: ['social media', 'graphics'] });
  const p6DescOk = p6Desc.status === 200;
  print('POST /ai/generate-description -> 200', p6DescOk, `status=${p6Desc.status}`);
  if (p6DescOk) {
    print('  Description returned', !!p6Desc.body?.data?.description);
    print('  Is meaningful response', (p6Desc.body?.data?.description || '').length > 20);
  }

  const p6Suggest = await request(app)
    .post('/v1/ai/suggest')
    .set('Authorization', `Bearer ${sellerToken}`)
    .send({ name: 'Premium Logo Design', category: 'DESIGN' });
  const p6SuggestOk = p6Suggest.status === 200;
  print('POST /ai/suggest -> 200', p6SuggestOk, `status=${p6Suggest.status}`);
  if (p6SuggestOk) {
    const d = p6Suggest.body?.data || {};
    print('  Tags suggested', Array.isArray(d.tags) && d.tags.length > 0);
    print('  Price suggested', d.priceSuggestion > 0);
  }

  // ════════════════════════════════════════════
  // PHASE 7 — Test purchasing as buyer
  // ════════════════════════════════════════════
  console.log('\nPHASE 7 — Purchasing as Buyer');

  // First fund the buyer's wallet
  const buyerWallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId: buyerId, currency: 'NGN' } },
  });
  const buyerWalletId = buyerWallet.id;
  // Add 10000 NGN to buyer wallet
  await prisma.wallet.update({
    where: { id: buyerWalletId },
    data: { balance: { increment: 10000 } },
  });
  const buyerBalAfter = await prisma.wallet.findUnique({ where: { id: buyerWalletId } });
  print('Buyer wallet funded', parseFloat(buyerBalAfter.balance) >= 10000, `balance=${buyerBalAfter.balance}`);

  // Record seller's balance before purchase
  const sellerWallet = await prisma.wallet.findUnique({
    where: { userId_currency: { userId: sellerId, currency: 'NGN' } },
  });
  const sellerBalanceBefore = parseFloat(sellerWallet?.balance || 0);
  print('Seller balance before purchase', true, `balance=${sellerBalanceBefore}`);

  const p7 = await request(app)
    .post(`/v1/store/${productId}/purchase`)
    .set('Authorization', `Bearer ${buyerToken}`)
    .send({ quantity: 1, currency: 'NGN' });
  const p7Ok = p7.status === 201;
  print('POST /store/:id/purchase -> 201', p7Ok, `status=${p7.status}`);
  if (p7Ok) {
    purchaseId = p7.body?.data?.id;
    print('Purchase ID obtained', !!purchaseId);

    // Verify buyer's wallet decreased
    const buyerAfter = await prisma.wallet.findUnique({ where: { id: buyerWalletId } });
    const buyerDecreased = parseFloat(buyerAfter.balance) <= parseFloat(buyerBalAfter.balance) - 5000;
    print('Buyer wallet decreased by 5000', buyerDecreased, `balance=${buyerAfter.balance}`);

    // Check seller got credited? The current code does NOT credit seller.
    const sellerAfter = await prisma.wallet.findUnique({
      where: { userId_currency: { userId: sellerId, currency: 'NGN' } },
    });
    const sellerCredited = parseFloat(sellerAfter.balance) > sellerBalanceBefore;
    print('Seller wallet credited', sellerCredited, `balance=${sellerAfter.balance} (before=${sellerBalanceBefore})`);
    if (!sellerCredited) {
      console.log('    ⚠ BUG: Purchase endpoint deducts buyer but does not credit seller');
    }

    // Verify transaction record
    const tx = await prisma.transaction.findFirst({
      where: { userId: buyerId, type: 'STORE_PURCHASE' },
      orderBy: { createdAt: 'desc' },
    });
    print('STORE_PURCHASE transaction recorded', !!tx, tx ? `ref=${tx.reference}` : '');

    // Verify StorePurchase record
    const sp = await prisma.storePurchase.findUnique({ where: { id: purchaseId } });
    print('StorePurchase record exists', !!sp, sp ? `status=${sp.status} total=${sp.totalPrice}` : '');
  } else {
    console.log('    Response:', JSON.stringify(p7.body));
  }

  // ════════════════════════════════════════════
  // PHASE 8 — Order history
  // ════════════════════════════════════════════
  console.log('\nPHASE 8 — Order History');

  // Buyer purchase history
  const p8Buyer = await prisma.storePurchase.findMany({
    where: { userId: buyerId },
    include: { item: true },
    orderBy: { createdAt: 'desc' },
  });
  print('Buyer has purchase history', p8Buyer.length > 0, `count=${p8Buyer.length}`);
  if (p8Buyer.length > 0) {
    print('  Most recent purchase matches product', p8Buyer[0].itemId === productId);
    print('  Purchase has item details', !!p8Buyer[0].item?.name);
  }

  // Seller sales history
  const p8Seller = await prisma.storePurchase.findMany({
    where: { item: { sellerId: sellerId } },
    include: { item: true, user: { select: { username: true } } },
    orderBy: { createdAt: 'desc' },
  });
  print('Seller has sales history', p8Seller.length > 0, `count=${p8Seller.length}`);
  if (p8Seller.length > 0) {
    print('  Sale includes buyer info', !!p8Seller[0].user?.username);
  }

  // ════════════════════════════════════════════
  // PHASE 9 — Edge cases
  // ════════════════════════════════════════════
  console.log('\nPHASE 9 — Edge Cases');

  // 9a: Insufficient balance
  const pe = `poor${ts}@store-e2e.com`;
  const pu = `st_poor_${ts}`.slice(-15);
  let poorBuyerRes;
  for (let attempt = 0; attempt < 3; attempt++) {
    poorBuyerRes = await request(app)
      .post('/v1/auth/register')
      .send({ email: pe, password: 'Test123!', firstName: 'Poor', lastName: 'Buyer', username: pu, role: 'WORKER' });
    if (poorBuyerRes.status === 201) break;
    await new Promise(r => setTimeout(r, 2000));
  }
  const poorBuyerToken = poorBuyerRes.body?.data?.tokens?.accessToken;
  const p9a = await request(app)
    .post(`/v1/store/${productId}/purchase`)
    .set('Authorization', `Bearer ${poorBuyerToken}`)
    .send({ quantity: 1, currency: 'NGN' });
  const p9aOk = p9a.status === 400 || p9a.status === 422;
  print('9a: Insufficient balance rejected', p9aOk, `status=${p9a.status} msg="${p9a.body?.message}"`);

  // 9b: Create product without imageUrl (should work - imageUrl is optional)
  const p9b = await request(app)
    .post('/v1/store/products')
    .set('Authorization', `Bearer ${sellerToken}`)
    .send({ name: 'No Image Product', description: 'Testing without image', price: 1000, category: 'OTHER' });
  print('9b: Product without imageUrl created', p9b.status === 201, `status=${p9b.status} imageUrl=${p9b.body?.data?.imageUrl}`);
  if (p9b.status === 201) await prisma.storeItem.delete({ where: { id: p9b.body.data.id } });

  // 9c: Missing required fields
  const p9c = await request(app)
    .post('/v1/store/products')
    .set('Authorization', `Bearer ${sellerToken}`)
    .send({ description: 'No name, no category, no price' });
  print('9c: Missing required fields rejected', p9c.status === 400, `status=${p9c.status} msg="${p9c.body?.message}"`);

  // 9d: Unauthenticated purchase
  const p9d = await request(app)
    .post(`/v1/store/${productId}/purchase`)
    .send({ quantity: 1 });
  const p9dOk = p9d.status === 401;
  print('9d: Unauthenticated purchase rejected', p9dOk, `status=${p9d.status}`);

  // 9e: Unauthenticated product creation
  const p9e = await request(app)
    .post('/v1/store/products')
    .send({ name: 'Hack', description: 'test', price: 100, category: 'OTHER' });
  const p9eOk = p9e.status === 401;
  print('9e: Unauthenticated product creation rejected', p9eOk, `status=${p9e.status}`);

  // 9f: Non-owner updating product
  const p9f = await request(app)
    .patch(`/v1/store/products/${productId}`)
    .set('Authorization', `Bearer ${buyerToken}`)
    .send({ name: 'Hacked name' });
  const p9fOk = p9f.status === 403;
  print('9f: Non-owner product update rejected', p9fOk, `status=${p9f.status}`);

  // 9g: AI falls back gracefully without API key
  const p9g = await request(app)
    .post('/v1/ai/generate-description')
    .set('Authorization', `Bearer ${sellerToken}`)
    .send({ name: 'Test', category: 'OTHER' });
  print('9g: AI description endpoint responds', p9g.status === 200, `status=${p9g.status}`);
  if (p9g.status === 200) {
    print('  Returns fallback content', !!p9g.body?.data?.description, `desc="${(p9g.body?.data?.description || '').slice(0, 60)}..."`);
  }

  // ════════════════════════════════════════════
  // PHASE 10 — Profile Avatar Upload
  // ════════════════════════════════════════════
  console.log('\nPHASE 10 — Profile Avatar Upload');
  const avatarImg = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const p10a = await request(app)
    .post('/v1/users/avatar')
    .set('Authorization', `Bearer ${buyerToken}`)
    .attach('avatar', avatarImg, 'test-avatar.png');
  const p10aOk = p10a.status === 200;
  print('POST /users/avatar -> 200', p10aOk, `status=${p10a.status}`);
  let avatarUrl = null;
  if (p10aOk) {
    avatarUrl = p10a.body?.data?.avatarUrl;
    print('  avatarUrl returned', !!avatarUrl, avatarUrl ? `url=${avatarUrl.slice(0, 60)}...` : '');
    print('  URL is persistent (https://)', avatarUrl?.startsWith('https://') === true);
  }

  // Verify the avatar URL is persisted on user profile
  const p10b = await request(app)
    .get('/v1/users/me')
    .set('Authorization', `Bearer ${buyerToken}`);
  const p10bOk = p10b.status === 200;
  print('GET /users/me -> 200', p10bOk, `status=${p10b.status}`);
  if (p10bOk && avatarUrl) {
    const savedUrl = p10b.body?.data?.avatarUrl;
    print('  avatarUrl matches upload', savedUrl === avatarUrl);
  }

  // ════════════════════════════════════════════
  // PHASE 11 — WURK-inspired profile fields
  // ════════════════════════════════════════════
  console.log('\nPHASE 11 — WURK Profile Fields');

  // Patch new fields
  const p11a = await request(app)
    .patch('/v1/users/me')
    .set('Authorization', `Bearer ${buyerToken}`)
    .send({ moreAbout: 'I am a top-rated worker on OgaPay with expertise in design and testing.', challengesParticipated: 10, challengesWon: 7, verifiedCreator: true });
  const p11aOk = p11a.status === 200;
  print('PATCH /users/me with new fields -> 200', p11aOk, `status=${p11a.status}`);

  // Verify via GET /users/me
  const p11b = await request(app)
    .get('/v1/users/me')
    .set('Authorization', `Bearer ${buyerToken}`);
  const p11bOk = p11b.status === 200;
  print('GET /users/me -> 200', p11bOk, `status=${p11b.status}`);
  if (p11bOk) {
    const u = p11b.body?.data || {};
    const wp = u.workerProfile || {};
    print('  moreAbout saved', wp.moreAbout === 'I am a top-rated worker on OgaPay with expertise in design and testing.');
    print('  challengesParticipated saved', wp.challengesParticipated === 10);
    print('  challengesWon saved', wp.challengesWon === 7);
    print('  verifiedCreator saved', u.verifiedCreator === true);
  }

  // Verify via store/workers/:id
  const p11c = await request(app).get(`/v1/store/workers/${buyerId}`);
  const p11cOk = p11c.status === 200;
  print('GET /store/workers/:id reflects fields', p11cOk, `status=${p11c.status}`);
  if (p11cOk) {
    const d = p11c.body?.data || {};
    print('  moreAbout in response', d.moreAbout?.includes('top-rated worker'));
    print('  challengesParticipated in response', d.challengesParticipated === 10);
    print('  challengesWon in response', d.challengesWon === 7);
    print('  verifiedCreator in response', d.verifiedCreator === true);
  }

  // ════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════');
  console.log('  STORE E2E TEST COMPLETE');
  console.log('═══════════════════════════════════════\n');

  await prisma.$disconnect();
}

main().then(() => {
  console.log('Test script finished.');
  cleanup().then(() => process.exit(0)).catch(() => process.exit(0));
}).catch(async (err) => {
  console.error('FATAL:', err.message);
  await cleanup().catch(() => {});
  process.exit(1);
});
