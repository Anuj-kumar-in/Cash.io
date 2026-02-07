# 🚀 Cash.io Vercel Deployment Guide

## Prerequisites

Before deploying, ensure you have:
- A [Vercel account](https://vercel.com/signup)
- A [GitHub/GitLab/Bitbucket](https://github.com) account with your code pushed
- [WalletConnect Project ID](https://cloud.walletconnect.com) (required for wallet connections)
- (Optional) [Pinata account](https://app.pinata.cloud) for IPFS storage

---

## 📋 Step-by-Step Deployment

### Step 1: Push Code to GitHub

```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Cash.io deployment"

# Add your GitHub repo as remote
git remote add origin https://github.com/YOUR_USERNAME/cash-io.git

# Push to GitHub
git push -u origin main
```

---

### Step 2: Import Project in Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Click **"Import"** next to your GitHub repository
4. Select **"Cash.io"** repository

---

### Step 3: Configure Build Settings

Vercel should auto-detect the settings from `vercel.json`, but verify:

| Setting | Value |
|---------|-------|
| **Framework Preset** | Vite |
| **Root Directory** | `.` (leave empty/root) |
| **Build Command** | `cd apps/web && npm run build:prod` |
| **Output Directory** | `apps/web/dist` |
| **Install Command** | `npm install` |

> **Note:** The `vercel.json` file already contains these settings.

---

### Step 4: Configure Environment Variables

Click **"Environment Variables"** and add the following:

#### Required Variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_WALLETCONNECT_PROJECT_ID` | `your_project_id` | Get from [WalletConnect Cloud](https://cloud.walletconnect.com) |
| `VITE_HUB_RPC_URL` | `https://sepolia.drpc.org` | Hub chain RPC (Sepolia for development) |

#### Contract Addresses (Testnet):

| Variable | Value |
|----------|-------|
| `VITE_SHIELDED_POOL_ADDRESS` | `0x...` (your deployed address) |
| `VITE_ZK_VERIFIER_ADDRESS` | `0x...` |
| `VITE_COMMITMENT_TREE_ADDRESS` | `0x...` |
| `VITE_ACCOUNT_FACTORY_ADDRESS` | `0x...` |
| `VITE_PAYMASTER_ADDRESS` | `0x...` |
| `VITE_ENTRY_POINT_ADDRESS` | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |

#### API Endpoints:

| Variable | Value |
|----------|-------|
| `VITE_BLOB_STORAGE_URL` | `https://your-api.vercel.app/blob` |
| `VITE_PROVER_URL` | `https://your-api.vercel.app/prover` |
| `VITE_BUNDLER_URL` | `https://api.stackup.sh/v1/node/YOUR_KEY` |

#### IPFS (Optional):

| Variable | Value |
|----------|-------|
| `VITE_IPFS_GATEWAY_URL` | `https://gateway.pinata.cloud` |
| `VITE_IPFS_API_URL` | `https://api.pinata.cloud` |
| `VITE_IPFS_JWT` | `your_pinata_jwt_token` |

#### Feature Flags:

| Variable | Value |
|----------|-------|
| `VITE_ENABLE_TESTNETS` | `true` (for testnet) / `false` (for production) |
| `VITE_ENABLE_SOLANA` | `true` |
| `VITE_ENABLE_BITCOIN_L2S` | `true` |

---

### Step 5: Deploy

1. Click **"Deploy"**
2. Wait for build to complete (2-3 minutes)
3. Your app will be live at `https://your-project.vercel.app`

---

## 🔧 Quick Deploy Commands

If you prefer CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from project root)
vercel

# Follow the prompts:
# ? Set up and deploy? Yes
# ? Which scope? Your account
# ? Link to existing project? No
# ? Project name: cash-io
# ? Directory with code: ./
# ? Override settings? No

# Deploy to production
vercel --prod
```

---

## 📝 Environment Variables via CLI

```bash
# Add environment variables
vercel env add VITE_WALLETCONNECT_PROJECT_ID
# Paste your WalletConnect Project ID when prompted
# Select: Production, Preview, Development

vercel env add VITE_HUB_RPC_URL
# Enter: https://sepolia.drpc.org

# Repeat for other variables...
```

---

## 🌐 Custom Domain Setup

1. Go to your Vercel project → **Settings** → **Domains**
2. Add your domain: `app.cash.io`
3. Configure DNS:
   - **Type**: CNAME
   - **Name**: app (or @ for root)
   - **Value**: cname.vercel-dns.com

---

## 🔄 Automatic Deployments

Once connected to GitHub, Vercel will:
- **Production deploy**: When you push to `main` branch
- **Preview deploy**: When you create a PR

---

## 🐛 Troubleshooting

### Build Fails: "Cannot find module"

```bash
# Solution: Clear cache and rebuild
vercel --force
```

### Environment Variables Not Loading

Make sure all `VITE_` prefixed variables are set in Vercel dashboard.

### "Page not found" on refresh

The `vercel.json` already has rewrites configured:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

### Build Timeout

For large projects, increase timeout in Vercel project settings.

---

## 📊 Post-Deployment Checklist

- [ ] Test wallet connection (MetaMask, WalletConnect)
- [ ] Test network switching
- [ ] Verify all pages load correctly
- [ ] Check Shield/Unshield functionality
- [ ] Test Bridge page network selection
- [ ] Verify Settings page loads
- [ ] Check mobile responsiveness
- [ ] Test in incognito mode

---

## 🔒 Security Best Practices

1. **Never commit `.env` files** - Use Vercel environment variables
2. **Enable branch protection** on GitHub for `main`
3. **Set up preview deployments** for PR review
4. **Use Vercel's Edge Config** for feature flags
5. **Enable Vercel Analytics** for monitoring

---

## 📈 Recommended Vercel Settings

Go to **Project Settings**:

| Setting | Recommended |
|---------|-------------|
| **Framework** | Vite |
| **Node.js Version** | 20.x |
| **Build Cache** | Enabled |
| **Function Region** | Auto (or closest to users) |
| **Speed Insights** | Enabled |
| **Web Analytics** | Enabled |

---

## 🎉 Your App is Live!

After successful deployment, your Cash.io app will be available at:
- Preview: `https://cash-io-git-main-your-username.vercel.app`
- Production: `https://cash-io.vercel.app` or your custom domain

---

## Next Steps

1. **Add custom domain** for branding
2. **Set up monitoring** (Sentry, LogRocket)
3. **Enable Vercel Analytics**
4. **Configure preview environments** for testing
5. **Set up GitHub Actions** for additional CI/CD

---

*Happy Deploying! 🚀*
