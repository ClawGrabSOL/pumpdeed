require('dotenv').config({ path: '.env.local' });
const express = require('express');
const path = require('path');
const OpenAI = require('openai');
const multer = require('multer');
const bs58 = require('bs58');
const { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ storage: multer.memoryStorage() });

// OpenAI for verification
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

// Solana connection
const connection = new Connection(
  process.env.HELIUS_RPC || 'https://api.mainnet-beta.solana.com',
  'confirmed'
);

// Pool wallet
let poolKeypair = null;
if (process.env.POOL_PRIVATE_KEY) {
  try {
    let secretKey;
    const pk = process.env.POOL_PRIVATE_KEY.trim();
    
    if (pk.startsWith('[')) {
      secretKey = new Uint8Array(JSON.parse(pk));
    } else if (pk.includes(',')) {
      secretKey = new Uint8Array(pk.split(',').map(n => parseInt(n.trim())));
    } else {
      secretKey = bs58.decode(pk);
    }
    
    poolKeypair = Keypair.fromSecretKey(secretKey);
    console.log('Pool wallet loaded:', poolKeypair.publicKey.toBase58());
  } catch (e) {
    console.log('Pool wallet not configured:', e.message);
  }
}

// AIployer Tasks
const jobs = [
  {
    id: 1,
    title: "Create a crypto tutorial video",
    description: "Record a short video (2-5 min) explaining a crypto concept like DeFi, NFTs, or staking. Post to YouTube, TikTok, or Twitter.",
    reward: 0.25,
    difficulty: "Medium",
    timeEstimate: "45 min",
    verificationPrompt: "Does this show a video tutorial about crypto? Look for: educational content, clear explanation, 2-5 minutes length, posted publicly on a video platform."
  },
  {
    id: 2,
    title: "Write a smart contract",
    description: "Write a simple Solana or EVM smart contract (escrow, token, or basic DeFi). Include deployment instructions.",
    reward: 0.50,
    difficulty: "Hard",
    timeEstimate: "2-4 hrs",
    verificationPrompt: "Does this show a working smart contract? Look for: code files, proper structure, deployment instructions, functional contract logic."
  },
  {
    id: 3,
    title: "Design crypto project banners",
    description: "Create a set of 3 social media banners for a crypto project (Twitter header 1500x500, Discord banner, and 1080x1080 square).",
    reward: 0.15,
    difficulty: "Easy",
    timeEstimate: "30 min",
    verificationPrompt: "Does this show social media banners? Look for: multiple banner sizes, professional design quality, crypto/web3 aesthetic."
  },
  {
    id: 4,
    title: "Translate crypto docs to Spanish",
    description: "Translate a README or documentation (500+ words) from English to Spanish. Must be natural, not machine-translated.",
    reward: 0.20,
    difficulty: "Medium",
    timeEstimate: "1 hr",
    verificationPrompt: "Does this show Spanish translation of crypto documentation? Look for: natural Spanish language, complete translation, proper formatting."
  },
  {
    id: 5,
    title: "Create crypto memes (set of 5)",
    description: "Make 5 high-quality memes about crypto, DeFi, NFTs, or trading. Must be funny, shareable, and original.",
    reward: 0.10,
    difficulty: "Easy",
    timeEstimate: "20 min",
    verificationPrompt: "Does this show crypto-related memes? Look for: humor, shareability, crypto theme, at least 5 distinct memes, original content."
  },
  {
    id: 6,
    title: "Build a Telegram price bot",
    description: "Create a Telegram bot that fetches and displays crypto prices. Should support at least 5 tokens and have a /price command.",
    reward: 0.40,
    difficulty: "Hard",
    timeEstimate: "3-5 hrs",
    verificationPrompt: "Does this show a Telegram bot for crypto prices? Look for: working bot code, Telegram API integration, price fetching, command handlers."
  },
  {
    id: 7,
    title: "Write a Twitter thread about DeFi",
    description: "Write a 5-7 tweet thread explaining a DeFi concept (yield farming, liquidity pools, etc.). Post it live on Twitter/X.",
    reward: 0.08,
    difficulty: "Easy",
    timeEstimate: "15 min",
    verificationPrompt: "Does this show a Twitter thread about DeFi? Look for: 5-7 tweets, educational content about DeFi, posted publicly."
  },
  {
    id: 8,
    title: "Research DEX comparison",
    description: "Create a comparison doc analyzing 5 DEXs (Uniswap, Jupiter, Raydium, etc.). Compare features, fees, chains, and volume.",
    reward: 0.18,
    difficulty: "Medium",
    timeEstimate: "1.5 hrs",
    verificationPrompt: "Does this show a comparison of DEX platforms? Look for: at least 5 DEXs compared, features/fees analysis, structured document format."
  },
  {
    id: 9,
    title: "Create ASCII art logo",
    description: "Design ASCII art for a crypto project. Should look good in monospace fonts and fit within 80 chars width.",
    reward: 0.06,
    difficulty: "Easy",
    timeEstimate: "20 min",
    verificationPrompt: "Does this show ASCII art? Look for: recognizable design, fits in 80 character width, looks good in monospace, creative/crypto themed."
  },
  {
    id: 10,
    title: "Find and report a bug",
    description: "Find a real bug in an open-source crypto project, document reproduction steps, and submit a GitHub issue.",
    reward: 0.15,
    difficulty: "Medium",
    timeEstimate: "varies",
    verificationPrompt: "Does this show a valid bug report? Look for: clear reproduction steps, actual bug, GitHub issue link, detailed description."
  }
];

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/tasks', (req, res) => res.sendFile(path.join(__dirname, 'public', 'tasks.html')));
app.get('/payouts', (req, res) => res.sendFile(path.join(__dirname, 'public', 'payouts.html')));

// API: Get available jobs
app.get('/api/jobs', (req, res) => {
  res.json(jobs.map(j => ({
    id: j.id,
    title: j.title,
    description: j.description,
    reward: j.reward,
    difficulty: j.difficulty,
    timeEstimate: j.timeEstimate
  })));
});

// API: Submit proof of work
app.post('/api/submit', upload.single('image'), async (req, res) => {
  try {
    const { jobId, wallet, proofText } = req.body;
    const imageFile = req.file;

    if (!jobId || !wallet) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const job = jobs.find(j => j.id === parseInt(jobId));
    if (!job) {
      return res.status(404).json({ error: 'Task not found' });
    }

    console.log(`\nSubmission for: "${job.title}"`);
    console.log(`  Wallet: ${wallet}`);
    console.log(`  Has image: ${!!imageFile}`);
    console.log(`  Notes: ${proofText || 'none'}`);

    let approved = false;
    let reason = '';

    if (openai && imageFile) {
      console.log('AI verification in progress...');
      
      const base64Image = imageFile.buffer.toString('base64');
      const mimeType = imageFile.mimetype;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a task verification AI for AIployer, a platform where people complete crypto-related tasks for payment.
            
Analyze submissions fairly but thoroughly. Approve good-faith efforts that meet the core requirements. Reject low-effort or off-topic submissions.

Respond with JSON: { "approved": true/false, "reason": "brief explanation (1-2 sentences)" }`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Task: ${job.title}
Description: ${job.description}
Verification criteria: ${job.verificationPrompt}

Worker's notes: ${proofText || 'none'}

Does this submission complete the task?`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 200
      });

      const result = JSON.parse(response.choices[0].message.content);
      approved = result.approved;
      reason = result.reason;
      
      console.log(`  Verdict: ${approved ? 'APPROVED' : 'REJECTED'}`);
      console.log(`  Reason: ${reason}`);
    } else {
      approved = true;
      reason = 'Auto-approved (demo mode - AI verification not configured)';
    }

    let txSignature = null;
    if (approved && poolKeypair) {
      try {
        console.log(`Sending ${job.reward} SOL to ${wallet}...`);
        
        const toPublicKey = new PublicKey(wallet);
        const lamports = Math.floor(job.reward * LAMPORTS_PER_SOL);

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: poolKeypair.publicKey,
            toPubkey: toPublicKey,
            lamports: lamports,
          })
        );

        txSignature = await connection.sendTransaction(transaction, [poolKeypair]);
        await connection.confirmTransaction(txSignature);
        
        console.log(`  Payment sent! Tx: ${txSignature}`);
      } catch (payErr) {
        console.error('  Payment failed:', payErr.message);
      }
    }

    res.json({
      success: true,
      approved,
      reason,
      reward: approved ? job.reward : 0,
      txSignature
    });

  } catch (error) {
    console.error('Submit error:', error);
    res.status(500).json({ error: 'Failed to process submission' });
  }
});

// API: Get pool info
app.get('/api/pool', async (req, res) => {
  try {
    if (poolKeypair) {
      const balance = await connection.getBalance(poolKeypair.publicKey);
      res.json({
        address: poolKeypair.publicKey.toBase58(),
        balance: balance / LAMPORTS_PER_SOL
      });
    } else {
      res.json({
        address: 'Not configured',
        balance: 0
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to get pool info' });
  }
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`\nAIployer running at http://localhost:${PORT}`);
  console.log(`Tasks: ${jobs.length} available`);
  if (!openai) console.log('OpenAI not configured - running in demo mode');
  if (!poolKeypair) console.log('Pool wallet not configured - payments disabled');
  console.log('');
});
