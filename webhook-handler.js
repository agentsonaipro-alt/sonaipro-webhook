// webhook-handler.js
// SonAiPro Registration → Supabase → Resend
// Includes Kit polling every 5 minutes
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
 
// Load .env manually
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...rest] = trimmed.split('=');
      process.env[key.trim()] = rest.join('=').trim();
    }
  }
}
 
// ===== CONFIG FROM .env =====
const CONFIG = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  KIT_API_SECRET: process.env.KIT_API_SECRET,
  PORT: process.env.PORT || 3000
};
console.log('✅ Config loaded from .env');
console.log('SUPABASE_URL:', CONFIG.SUPABASE_URL);
console.log('RESEND_API_KEY exists:', !!CONFIG.RESEND_API_KEY);
console.log('KIT_API_SECRET exists:', !!CONFIG.KIT_API_SECRET);
 
// Track processed emails in memory to avoid duplicates
const processedEmails = new Set();
 
// ===== HELPER: Make HTTPS Requests =====
function makeRequest(url, method, headers, body) {
  return new Promise((resolve, reject) => {
    const options = new URL(url);
    const client = url.startsWith('https') ? https : http;
    const bodyString = body ? JSON.stringify(body) : '';
 
    const req = client.request(
      {
        hostname: options.hostname,
        path: options.pathname + options.search,
        method: method,
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(bodyString)
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data: data });
          }
        });
      }
    );
 
    req.on('error', reject);
    if (bodyString) req.write(bodyString);
    req.end();
  });
}
 
// ===== STORE IN SUPABASE =====
async function storeSubscriber(email, firstName) {
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/subscribers`;
 
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
    'apikey': CONFIG.SUPABASE_ANON_KEY,
    'Prefer': 'resolution=ignore-duplicates'
  };
 
  const body = {
    email: email,
    first_name: firstName,
    created_at: new Date().toISOString()
  };
 
  try {
    const response = await makeRequest(url, 'POST', headers, body);
    console.log('Supabase status:', response.status);
 
    if (response.status >= 200 && response.status < 300) {
      console.log('✅ Stored in Supabase:', email);
      return true;
    } else {
      console.error('❌ Supabase error:', response.status, JSON.stringify(response.data));
      return false;
    }
  } catch (error) {
    console.error('❌ Supabase error:', error);
    return false;
  }
}
 
// ===== SEND WELCOME EMAIL =====
async function sendWelcomeEmail(email, firstName) {
  const url = 'https://api.resend.com/emails';
 
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CONFIG.RESEND_API_KEY}`
  };
 
  const emailBody = {
    from: 'admin@contact.sonaipro.com',
    to: email,
    subject: "Welcome to SonAiPro — here's what you've got access to",
    html: `
<html>
<body style="font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1a1a2e;">
<p>Hi ${firstName || 'there'},</p>
<p>You just joined SonAiPro. Here's what that means.</p>
<p>We built SonAiPro for one reason: to make AI accessible, actionable, and digestible for business professionals who don't have hours to figure it out.</p>
<p>You're getting access to three things that work together.</p>
<hr style="border: none; border-top: 1px solid #e2e2e6; margin: 20px 0;">
<h3>1. Daily News at 5 — In Your Inbox, Every Weekday</h3>
<p>Five AI stories, scored and ranked for what actually matters to your work.</p>
<p>Not the hype. Not everything that happened. Just the moves that affect how you decide, what you do, and how you compete.</p>
<p>Your first briefing lands tomorrow at 5pm. Then every weekday after that. It takes about 5 minutes to read.</p>
<hr style="border: none; border-top: 1px solid #e2e2e6; margin: 20px 0;">
<h3>2. A Growing Library of Resources — Real Experiences, Real Opinions</h3>
<p>As you navigate AI, you'll want to know three things.</p>
<p><strong>Prompts & Skills</strong> — Ready-to-use templates for real business work. Finance forecasting. Sales strategy. Operations automation. You copy, you paste, you adapt to your situation.</p>
<p><strong>Tool Reviews</strong> — What's actually worth adopting. Why other people are using it. What the limitations are. Written by people doing the work, not by marketers.</p>
<p><strong>Real Experiences</strong> — How peers in your sector are putting AI to work. Their wins. Their blockers. What they'd do differently.</p>
<p>You get access to all of this right now.</p>
<p>Want to go deeper? Refer five friends to SonAiPro and unlock GOLD membership. You'll get expanded versions of everything — more advanced prompts, deeper tool analysis, richer peer insights. Plus access to our quarterly AI Trends Report: McKinsey-style state-of-the-nation intelligence, but actually useful.</p>
<hr style="border: none; border-top: 1px solid #e2e2e6; margin: 20px 0;">
<h3>3. Community (We're In Beta — But The Ambition Is Big)</h3>
<p>We're building a space where you can ask questions, see what peers are doing, and learn from real experience.</p>
<p>Right now, we're being intentional about curation. We want this to be <em>useful</em> not <em>overwhelming</em>. So we're starting small, keeping it focused, making sure the conversations actually matter.</p>
<p>The ambition: dynamic chat, smart filtering, sector-specific channels — so you find exactly what's relevant to you. We're getting there, but we're doing it thoughtfully.</p>
<p>For now, ask a question. Share a win. See what other operators in your world are figuring out. It's a real community with real people, not a noise machine.</p>
<hr style="border: none; border-top: 1px solid #e2e2e6; margin: 20px 0;">
<h3>Help Us Help You Better</h3>
<p>Tell us about your world — what sector you work in, what challenges you're trying to solve. We'll make sure the prompts, the tool reviews, and the community conversations are actually relevant to <em>you</em>.</p>
<p>Just reply to this email with your sector and what matters most. Or click one of these:</p>
<p>
👉 <a href="https://sonaipro.com/preferences?email=${email}&sector=finance">I work in Finance & Strategy</a><br>
👉 <a href="https://sonaipro.com/preferences?email=${email}&sector=sales">I work in Sales & Marketing</a><br>
👉 <a href="https://sonaipro.com/preferences?email=${email}&sector=operations">I work in Operations, HR or Legal</a><br>
👉 <a href="https://sonaipro.com/preferences?email=${email}&sector=product">I work in Product or Engineering</a><br>
👉 <a href="https://sonaipro.com/preferences?email=${email}&sector=cx">I work in Customer Experience</a>
</p>
<p>No pressure — you'll get solid content either way. But we genuinely care about making this <em>actually useful for you</em>, not just generic.</p>
<hr style="border: none; border-top: 1px solid #e2e2e6; margin: 20px 0;">
<h3>Jump In Whenever You're Ready</h3>
<p>Your first daily briefing lands tomorrow at 5pm.</p>
<p>In the meantime, if you want to explore — see the resource library, check out community conversations, or just get a feel for the place — head to <a href="https://sonaiprocommunitypages.netlify.app/">https://sonaiprocommunitypages.netlify.app/</a>.</p>
<hr style="border: none; border-top: 1px solid #e2e2e6; margin: 20px 0;">
<p>You've got this. And you're not figuring it out alone.</p>
<p>The SonAiPro Team</p>
</body>
</html>
    `
  };
 
  try {
    const response = await makeRequest(url, 'POST', headers, emailBody);
    if (response.status >= 200 && response.status < 300) {
      console.log('✅ Welcome email sent:', email);
      return true;
    } else {
      console.error('❌ Resend error:', response.status, JSON.stringify(response.data));
      return false;
    }
  } catch (error) {
    console.error('❌ Resend error:', error);
    return false;
  }
}
 
// ===== PROCESS A SUBSCRIBER =====
async function processSubscriber(email, firstName) {
  if (processedEmails.has(email)) {
    console.log(`⏭️  Already processed: ${email}`);
    return;
  }
  processedEmails.add(email);
 
  console.log(`\n🔄 Processing: ${email}`);
  const stored = await storeSubscriber(email, firstName);
  if (stored) {
    await sendWelcomeEmail(email, firstName);
    console.log(`✅ Done: ${email}\n`);
  } else {
    console.log(`⚠️  Skipping email for ${email} — Supabase insert failed\n`);
  }
}
 
// ===== POLL KIT FOR NEW SUBSCRIBERS =====
async function pollKitSubscribers() {
  console.log(`\n🔍 Polling Kit for new subscribers...`);
 
  // Get the 10 most recent subscribers — no date filter, use in-memory Set to avoid duplicates
  const url = `https://api.convertkit.com/v3/subscribers?api_secret=${CONFIG.KIT_API_SECRET}&sort_order=desc&limit=10`;
 
  try {
    const response = await makeRequest(url, 'GET', { 'Content-Type': 'application/json' }, null);
 
    if (response.status !== 200) {
      console.error('❌ Kit API error:', response.status, JSON.stringify(response.data));
      return;
    }
 
    const subscribers = response.data?.subscribers || [];
 
    if (subscribers.length === 0) {
      console.log('📭 No new subscribers found');
      return;
    }
 
    console.log(`📬 Found ${subscribers.length} new subscriber(s)`);
 
    for (const sub of subscribers) {
      const email = sub.email_address;
      const firstName = sub.first_name || 'there';
      await processSubscriber(email, firstName);
    }
  } catch (error) {
    console.error('❌ Kit polling error:', error.message);
  }
}
 
// ===== WEBHOOK HANDLER (manual trigger fallback) =====
async function handleWebhook(req, res) {
  console.log(`\n📨 Request received: ${req.method} ${req.url}`);
 
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
 
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
 
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }
 
  let body = '';
  req.on('data', (chunk) => { body += chunk.toString(); });
  req.on('end', async () => {
    try {
      const data = JSON.parse(body);
      const email = data.email || data.subscriber?.email;
      const firstName = data.first_name || data.subscriber?.first_name || 'there';
 
      if (!email) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No email provided' }));
        return;
      }
 
      await processSubscriber(email, firstName);
 
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, email: email }));
    } catch (error) {
      console.error('❌ Webhook error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
}
 
// ===== START SERVER =====
const server = http.createServer(handleWebhook);
server.listen(CONFIG.PORT, () => {
  console.log(`
✅ SonAiPro Webhook Server Running
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Listening on: http://localhost:${CONFIG.PORT}
Kit polling: every 5 minutes
Supabase: ${CONFIG.SUPABASE_URL}
Resend: Configured
  `);
 
  // Run once on startup, then every 5 minutes
  pollKitSubscribers();
  setInterval(pollKitSubscribers, 5 * 60 * 1000);
});
 
process.on('SIGTERM', () => {
  console.log('Server shutting down...');
  server.close();
});
 