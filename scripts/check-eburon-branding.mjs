#!/usr/bin/env node
/**
 * Eburon Branding Validation Script
 *
 * Scans the repository for prohibited upstream provider/model brand names,
 * including model-version regex patterns. The intent is to keep Eburon's
 * brand clean across user-facing lore, system prompts, config, and docs.
 *
 * Failure means: a third-party provider / model name leaked somewhere it
 * shouldn't have. Allowed sites:
 *   - the brand-check script itself,
 *   - the single voiceSession.ts wrapper (sole owner of the realtime SDK),
 *   - node_modules, lockfiles, dist, images, etc. (ignored).
 *
 * Usage: node scripts/check-eburon-branding.mjs
 *
 * Run via:
 *   npm run check:eburon-branding
 *   npm run verify   (lint + this)
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Prohibited tokens (case-insensitive substring search).
// Any of these appearing in a user-visible file = brand leak.
const PROHIBITED_TOKENS = [
  // ── Google AI ──
  'gemini',
  'google-genai',
  'google generative',
  'generative-ai',
  'google-generative-ai',
  'gemma',
  'palm',
  'bard',
  'vertex ai',
  'vertexai',
  // ── OpenAI ──
  'openai',
  'open.ai',
  'chatgpt',
  'dall-e',
  'dalle',
  'whisper-1',
  // ── Anthropic ──
  'anthropic',
  'claude',
  // ── Meta / Mistral / open-source base models ──
  'llama',
  'meta-llama',
  'meta ai',
  'codellama',
  'mistral',
  'mixtral',
  'deepseek',
  'qwen',
  'qwq',
  // ── Other providers ──
  'cohere',
  'groq',
  'perplexity',
  'together.ai',
  'fireworks.ai',
  'replicate',
  // ── Hugging Face ──
  'huggingface',
  'hugging face',
  // ── Generic SDKs that imply third-party providers ──
  'langchain',
  'llamaindex',
  'autogen',
  'crewai',
  'semantic-kernel',
  // ── Local-runner names (server-side only) ──
  'ollama',
  'lm studio',
  'lmstudio',
  'kobold',
];

// Prohibited regexes (case-insensitive). Catches version-suffixed model
// names that substring search misses (e.g. `gpt4`, `claude-3`, `llama3.1`).
const PROHIBITED_REGEX = [
  /\b(gpt|claude|gemini|llama|mistral|deepseek|qwen|phi|mixtral|gemma|palm)[_\s.-]?\d/i,
  /\bo[1234]\b/i,
];

// Allowlist: files where tokens are permitted (own-name allowed only in
// specifically approved places — the brand-check script and the single
// voiceSession wrapper).
const ALLOWLIST_GLOB = [
  'node_modules/',
  '.git/',
  'dist/',
  '.vite/',
  'package-lock.json',
  'supabase/.temp/',
  'supabase/.branches/',
  '*.mmd',
  '*.svg',
  '*.png',
  '*.mp3',
  '*.gif',
  '.svg',
  // Brand-script self-reference.
  'scripts/check-eburon-branding.mjs',
  // Single client-side import site for the realtime SDK; everything else
  // must go through this wrapper's public surface.
  'src/lib/voiceSession.ts',
];

// Scanned paths (relative to repo root).
const SCAN_PATHS = [
  '.env.example',
  '.env.local.example',
  '.env.whatsapp.example',
  'render.yaml',
  'vercel.json',
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'README.md',
  'AGENTS.md',
  'CLAUDE.md',
  'MEMORY.md',
  'TASK.md',
  'security_spec.md',
  'server/',
  'src/',
  'public/',
  'docs/',
  'scripts/',
  'supabase/',
  'ecosystem.config.cjs',
  'Dockerfile',
  'Dockerfile.whatsapp',
  'docker-compose.whatsapp.yml',
  'docker-compose.dokploy.yml',
  'firebase.json',
  'twa-manifest.json',
  '.github/',
  'functions/',
];

function isAllowed(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  for (const pattern of ALLOWLIST_GLOB) {
    if (pattern.endsWith('/') && normalized.includes(pattern)) return true;
    if (normalized.endsWith(pattern)) return true;
  }
  return false;
}

function lineNumberAtIndex(content, idx) {
  const lines = content.split('\n');
  let charCount = 0;
  for (let i = 0; i < lines.length; i++) {
    charCount += lines[i].length + 1;
    if (charCount > idx) return i + 1;
  }
  return lines.length;
}

function snippetOfLine(content, lineNum) {
  const lines = content.split('\n');
  return (lines[lineNum - 1] || '').trim().slice(0, 120);
}

function scanFile(filePath) {
  if (isAllowed(filePath)) return [];

  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const lowerContent = content.toLowerCase();
  const matches = [];

  // Substring scan.
  for (const token of PROHIBITED_TOKENS) {
    const idx = lowerContent.indexOf(token);
    if (idx !== -1) {
      const lineNum = lineNumberAtIndex(content, idx);
      matches.push({
        type: 'token',
        token,
        line: lineNum,
        snippet: snippetOfLine(content, lineNum),
      });
    }
  }

  // Regex scan.
  for (const pattern of PROHIBITED_REGEX) {
    const re = new RegExp(pattern.source, pattern.flags.replace('g', '') + 'g');
    let m;
    while ((m = re.exec(content)) !== null) {
      const lineNum = lineNumberAtIndex(content, m.index);
      matches.push({
        type: 'regex',
        token: m[0],
        line: lineNum,
        snippet: snippetOfLine(content, lineNum),
      });
      if (re.lastIndex === m.index) re.lastIndex++;
    }
  }

  return matches;
}

function getTrackedFiles() {
  try {
    const output = execSync('git ls-files', { cwd: ROOT, encoding: 'utf-8' });
    return output.split('\n').filter(Boolean).map((f) => path.join(ROOT, f));
  } catch {
    const files = [];
    for (const scanPath of SCAN_PATHS) {
      const fullPath = path.join(ROOT, scanPath);
      if (!existsSync(fullPath)) continue;
      try {
        const s = execSync(`find "${fullPath}" -type f 2>/dev/null`, { encoding: 'utf-8' });
        files.push(...s.split('\n').filter(Boolean));
      } catch {
        if (existsSync(fullPath) && !fullPath.endsWith('/')) files.push(fullPath);
      }
    }
    return files;
  }
}

function main() {
  console.log('🔍 Scanning for prohibited provider/model brand names...\n');

  const files = getTrackedFiles();
  const allMatches = [];

  for (const file of files) {
    const matches = scanFile(file);
    if (matches.length > 0) {
      allMatches.push(...matches.map((m) => ({ file, ...m })));
    }
  }

  if (allMatches.length === 0) {
    console.log('✅ No prohibited branding found. All clean!');
    process.exit(0);
  }

  console.log(`❌ Found ${allMatches.length} prohibited brand reference(s):\n`);
  for (const match of allMatches) {
    const relPath = path.relative(ROOT, match.file);
    console.log(`  ${relPath}:${match.line}  [${match.type}]`);
    console.log(`    Match: "${match.token}"`);
    console.log(`    Context: "${match.snippet}"\n`);
  }

  console.log('\nAll references must use Eburon aliases instead.');
  console.log('See AGENTS.md or .env.local.example for Eburon naming conventions.');
  console.log('If a literal SDK import is required, isolate it in src/lib/voiceSession.ts and add the file to ALLOWLIST_GLOB.');
  process.exit(1);
}

main();
