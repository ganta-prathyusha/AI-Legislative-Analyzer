# 🏛️ Citizen's Dashboard — AI Legislative Analyzer

A free, browser-based tool that converts dense Indian laws and parliamentary bills into plain-English summaries using **Token Compression** + **Groq LLM**.

Built for **Project 3: AI Legislative Analyzer** — optimized for information density and energy efficiency.

---

## Features

- Upload any PDF bill/law or paste text directly
- Handles documents exceeding 100k tokens via token compression
- Shows compression stats: original tokens → compressed tokens → % saved → information density score
- Structured output: summary, key points, impact analysis, advantages, concerns, verdict
- Free to run — uses Groq's free API tier (no credit card)

---

## How to Run

**Requirements:** Python 3 (any version) + internet connection

```bash
cd legislative-analyzer
python -m http.server 8080
```

Open your browser at `http://localhost:8080`

> Must use a local server (not double-click) because PDF.js requires HTTP, not file://

---

## Get a Free Groq API Key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up with Google or GitHub (no credit card)
3. Click **API Keys** → **Create API Key**
4. Copy the key (starts with `gsk_`) and paste it into the app

---

## How Token Compression Works

Large legal documents (100k+ tokens) are compressed to ~5,500 tokens before being sent to the LLM:

```
Raw Document (100k tokens)
        ↓
  1. Clean  — remove page numbers, decorative lines, boilerplate
  2. Segment — split into paragraphs/sections
  3. Score   — TF-IDF scoring + legal signal boost (shall, must, penalty...)
  4. Dedup   — remove near-duplicate segments (Jaccard similarity)
  5. Pack    — greedily fill up to token budget, restore document order
        ↓
Compressed Prompt (~5,500 tokens) → Groq LLM → Structured JSON
```

This reduces LLM token usage by 90–98%, directly cutting energy/carbon cost.

---

## Project Structure

```
legislative-analyzer/
├── index.html       — UI layout
├── style.css        — Dark theme styles
├── app.js           — Main app (compression pipeline + Groq API)
├── app_source.js    — Source file (copy to app.js via write_app.py)
├── write_app.py     — Helper script to write app.js from app_source.js
└── README.md        — This file
```

---

## Tech Stack

- Vanilla HTML/CSS/JS — no framework, no build step
- [PDF.js](https://mozilla.github.io/pdf.js/) — client-side PDF text extraction
- [Groq API](https://console.groq.com) — free LLM inference (`llama-3.1-8b-instant`)
- TF-IDF + Jaccard deduplication — custom token compression pipeline

---

## Judging Criteria Addressed

| Criteria | Implementation |
|---|---|
| 100k+ token documents | Token compression pipeline handles any size |
| Token Compression technique | TF-IDF scoring, Jaccard dedup, greedy packing |
| Information Density score | Displayed in UI: unique concepts retained per token consumed |
| Energy efficiency | 90–98% fewer tokens sent to LLM per request |
