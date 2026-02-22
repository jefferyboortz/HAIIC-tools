# HAIC Tools — Brainstorm & Patent Forge

AI-powered patent democratization tools by the Human-AI Innovation Commons.

## What's Inside

- **Brainstorm** — AI coach that helps inventors discover patentable innovations in their expertise
- **Patent Forge** — Guided provisional patent drafting with real-time AI assistance
- **Benefit-Sharing Agreement** — Built-in acknowledgment of HAIC's 33/33/33 framework

## Deploy to Vercel (Step by Step)

### 1. Upload this project to GitHub

1. Go to https://github.com and log in
2. Click the **+** button (top right) → **New repository**
3. Name it `haic-tools`
4. Keep it **Public** (or Private if you prefer)
5. Click **Create repository**
6. On the next page, click **"uploading an existing file"** link
7. Drag and drop ALL the files from this project folder
8. Click **Commit changes**

### 2. Get your Anthropic API Key

1. Go to https://console.anthropic.com
2. Sign up or log in
3. Go to **API Keys** in the left sidebar
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-...`) — you'll need it in step 3

### 3. Deploy on Vercel

1. Go to https://vercel.com and log in with your GitHub account
2. Click **Add New → Project**
3. Find `haic-tools` in the list and click **Import**
4. Before clicking Deploy, expand **Environment Variables**
5. Add: Name = `ANTHROPIC_API_KEY`, Value = [paste your key from step 2]
6. Click **Deploy**
7. Wait ~60 seconds — Vercel will give you a URL like `haic-tools.vercel.app`

### 4. You're Live!

Share the URL in your Mozilla application. Anyone with the link can use both tools.

## Iterating

Every time you push changes to GitHub, Vercel automatically redeploys. To update:

1. Edit files on GitHub (click any file → pencil icon → edit → commit)
2. Or: ask Claude to make changes, download the updated files, and re-upload to GitHub

## Costs

- **Vercel hosting**: Free (Hobby plan)
- **Anthropic API**: ~$0.15 per full patent session
- **Domain**: Optional ($12/year if you want a custom domain)

## Local Development (Optional)

```bash
npm install
cp .env.example .env.local  # then add your API key
npm run dev                  # opens at http://localhost:3000
```
