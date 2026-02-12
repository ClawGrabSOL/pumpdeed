# AIployer

Get paid in crypto for completing tasks. AI verifies your work, you get paid instantly.

## Features

- **Multi-currency payouts** — BTC, ETH, SOL, USDC
- **AI verification** — GPT-4o reviews submissions
- **Instant payments** — Approved work = immediate crypto transfer
- **No KYC** — Just your wallet address

## Setup

```bash
npm install
```

Create `.env.local`:

```env
OPENAI_API_KEY=sk-...
POOL_PRIVATE_KEY=your-solana-private-key
HELIUS_RPC=https://mainnet.helius-rpc.com/?api-key=...
```

## Run

```bash
npm start
```

Visit `http://localhost:3003`

## Stack

- Node.js / Express
- OpenAI GPT-4o for verification
- Solana for payments

## Tasks

Tasks are defined in `server.js`. Each task has:
- Title and description
- Reward amount (SOL)
- Difficulty level
- Verification prompt for AI

## API

- `GET /api/jobs` — List available tasks
- `POST /api/submit` — Submit proof of work
- `GET /api/pool` — Get pool balance

---

Built for the AI age.
