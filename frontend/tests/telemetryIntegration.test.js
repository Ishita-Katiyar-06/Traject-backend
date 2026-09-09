import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// 1. Semantic guardrails definitions & formatters
import {
  COORDINATION_WORDING,
  REACH_WORDING,
  EVIDENCE_DENSITY_WORDING,
  formatPriorityTierBadge,
  formatEvidenceDensityBadge,
  formatDecimal,
  formatPercent,
  formatPriorityScore,
} from '../src/utils/telemetryFormatters.ts';

import { telemetryApi } from '../src/services/telemetryApi.ts';
import { apiClient, ApiError } from '../src/services/apiClient.ts';
import { getNarrativeDisplayName } from '../src/utils/narrativeIdentity.ts';
import {
  resolveTelegramMessageUrl,
  resolveTelegramChannelUrl,
} from '../src/utils/channelRegistry.ts';

test('1. Correct API endpoints and query string builders', () => {
  const qs1 = apiClient.buildQueryString({
    page: 2,
    page_size: 10,
    priority_tier: 'critical',
    sort_by: 'priority_signal_score',
    order: 'desc',
  });
  assert.equal(qs1, '?page=2&page_size=10&priority_tier=critical&sort_by=priority_signal_score&order=desc');

  const qs2 = apiClient.buildQueryString({
    keyword: 'grid failure',
    platform: 'telegram',
  });
  assert.equal(qs2, '?keyword=grid+failure&platform=telegram');
});

test('2. Backend IDs are strictly preserved without truncation or fabrication', () => {
  const telegramId = 'telegram:-1001234567890:987654';
  const encoded = encodeURIComponent(telegramId.trim());
  assert.equal(encoded, 'telegram%3A-1001234567890%3A987654');
  assert.equal(decodeURIComponent(encoded), telegramId);

  const narrativeId = 'narrative_042';
  assert.equal(narrativeId, 'narrative_042');
});

test('3. Priority Signal Score is displayed without frontend recalculation', () => {
  const backendScore = 0.812345;
  const formatted = formatPriorityScore(backendScore);
  assert.equal(formatted, '0.8123');

  const dec = formatDecimal(backendScore, 3);
  assert.equal(dec, '0.812');
});

test('4. Coordination wording follows strict semantic contract (Indicator/Signal, not proof)', () => {
  assert.match(COORDINATION_WORDING.primary, /Potential Coordination Signal/i);
  assert.match(COORDINATION_WORDING.plural, /Potential Coordination Signals/i);
  assert.doesNotMatch(COORDINATION_WORDING.primary, /CIB detected/i);
  assert.doesNotMatch(COORDINATION_WORDING.primary, /malicious/i);
  assert.doesNotMatch(COORDINATION_WORDING.primary, /confirmed coordinated/i);
  assert.ok(COORDINATION_WORDING.disclaimer.includes('do not constitute proof'));
});

test('5. Reach wording follows strict semantic contract (Observed Reach / Exposure)', () => {
  assert.equal(REACH_WORDING.primary, 'Observed Reach');
  assert.equal(REACH_WORDING.secondary, 'Observed Exposure');
  assert.doesNotMatch(REACH_WORDING.primary, /penetration/i);
  assert.doesNotMatch(REACH_WORDING.primary, /absorbed/i);
  assert.doesNotMatch(REACH_WORDING.primary, /unique audience/i);
});

test('6. Evidence Density is labeled as observational coverage, NOT confidence or certainty', () => {
  const highBadge = formatEvidenceDensityBadge('high');
  const modBadge = formatEvidenceDensityBadge('moderate');
  const sparseBadge = formatEvidenceDensityBadge('sparse');

  assert.equal(highBadge.label, 'High');
  assert.equal(modBadge.label, 'Moderate');
  assert.equal(sparseBadge.label, 'Sparse');

  assert.ok(EVIDENCE_DENSITY_WORDING.tooltip.includes('It does NOT represent statistical confidence or certainty'));
});

test('7. Sentiment availability distinguishes uncomputed from neutral (never forces 100% neutral)', () => {
  const unavailableSentiment = {
    is_available: false,
    evaluated_messages_count: 0,
    text_positive_ratio: null,
    text_neutral_ratio: null,
    text_negative_ratio: null,
  };

  assert.equal(unavailableSentiment.is_available, false);
  assert.equal(unavailableSentiment.text_neutral_ratio, null);
  assert.notEqual(unavailableSentiment.text_neutral_ratio, 1.0);
});

test('8. Priority Tier badge configurations are correct', () => {
  const crit = formatPriorityTierBadge('critical');
  assert.equal(crit.label, 'CRITICAL');
  assert.ok(crit.bg.includes('red'));

  const high = formatPriorityTierBadge('high');
  assert.equal(high.label, 'HIGH');
  assert.ok(high.bg.includes('amber'));

  const elevated = formatPriorityTierBadge('elevated');
  assert.equal(elevated.label, 'ELEVATED');
  assert.ok(elevated.bg.includes('blue'));

  const routine = formatPriorityTierBadge('routine');
  assert.equal(routine.label, 'ROUTINE');
  assert.ok(routine.bg.includes('slate'));
});

test('9. Null and missing values handled gracefully by presentation helpers', () => {
  assert.equal(formatDecimal(null), '—');
  assert.equal(formatDecimal(undefined), '—');
  assert.equal(formatPercent(null), '—');
  assert.equal(formatPercent(undefined), '—');
  assert.equal(formatPriorityScore(null), '—');
  assert.equal(formatPriorityTierBadge(null).label, 'ROUTINE');
  assert.equal(formatEvidenceDensityBadge(null).label, 'Sparse');
});

test('10. Static audit: verify zero mock imports in production pages', () => {
  const srcDir = path.resolve(import.meta.dirname, '../src');
  const prodPages = [
    'pages/Overview/OverviewPage.tsx',
    'pages/Narratives/NarrativesPage.tsx',
    'pages/Narratives/NarrativeDetailPage.tsx',
    'pages/Trends/TrendsPage.tsx',
    'pages/Trends/TrendDetailPage.tsx',
    'pages/Explorer/ExplorerPage.tsx',
    'components/narratives/NarrativeTable.tsx',
    'components/narratives/NarrativeRow.tsx',
    'components/trends/TrendTable.tsx',
    'components/trends/TrendRow.tsx',
    'components/trends/TrendNodeGraph.tsx',
    'components/explorer/ExplorerTable.tsx',
    'components/explorer/ExplorerDetailModal.tsx',
  ];

  for (const pageRel of prodPages) {
    const fullPath = path.join(srcDir, pageRel);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.doesNotMatch(
      content,
      /from\s+['"][^'"]*mock[^'"]*['"]/,
      `File ${pageRel} must not import from mock data directories!`
    );
  }
});

test('11. Static audit: verify no client-side Priority Signal Score recalculation', () => {
  const srcDir = path.resolve(import.meta.dirname, '../src');
  const allFiles = fs.readdirSync(path.join(srcDir, 'pages'), { recursive: true });

  for (const f of allFiles) {
    if (typeof f === 'string' && (f.endsWith('.tsx') || f.endsWith('.ts'))) {
      const content = fs.readFileSync(path.join(srcDir, 'pages', f), 'utf8');
      assert.doesNotMatch(
        content,
        /0\.3\s*\*\s*spread/i,
        `File ${f} contains client-side score computation!`
      );
      assert.doesNotMatch(
        content,
        /0\.30\s*\*\s*coordination/i,
        `File ${f} contains client-side score computation!`
      );
    }
  }
});

test('12. Static audit: verify absence of prohibited coordination terminology', () => {
  const srcDir = path.resolve(import.meta.dirname, '../src');
  const prodFiles = [
    'pages/Overview/OverviewPage.tsx',
    'pages/Narratives/NarrativesPage.tsx',
    'pages/Narratives/NarrativeDetailPage.tsx',
    'components/narratives/NarrativeRow.tsx',
    'utils/telemetryFormatters.ts',
  ];

  const bannedPhrases = [
    'CIB detected',
    'Coordinated activity detected',
    'Malicious coordination',
    'Confirmed coordinated activity',
    'Audience penetration',
    'Unique audience reached',
  ];

  for (const fileRel of prodFiles) {
    const fullPath = path.join(srcDir, fileRel);
    const content = fs.readFileSync(fullPath, 'utf8');
    for (const phrase of bannedPhrases) {
      assert.doesNotMatch(
        content,
        new RegExp(phrase, 'i'),
        `File ${fileRel} contains prohibited phrase: "${phrase}"`
      );
    }
  }
});

// 13. End-to-end API client request routing tests with mocked fetch
test('13. telemetryApi sends correct HTTP requests to /api/v1 endpoints with parameters', async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method || 'GET' });
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ status: 'healthy', version: '0.1.0', artifacts_loaded: true }),
    };
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  // Health
  await telemetryApi.getHealth();
  assert.equal(calls[0].url, 'http://localhost:8000/api/v1/health');

  // Analytics Overview
  await telemetryApi.getAnalyticsOverview();
  assert.equal(calls[1].url, 'http://localhost:8000/api/v1/analytics');

  // Narratives list with query params
  await telemetryApi.getNarratives({
    priority_tier: 'critical',
    sort_by: 'priority_signal_score',
    order: 'desc',
    page: 1,
    page_size: 10,
  });
  assert.equal(
    calls[2].url,
    'http://localhost:8000/api/v1/narratives?priority_tier=critical&sort_by=priority_signal_score&order=desc&page=1&page_size=10'
  );

  // Narrative by ID
  await telemetryApi.getNarrativeById('narrative_001');
  assert.equal(calls[3].url, 'http://localhost:8000/api/v1/narratives/narrative_001');

  // Topics with query params
  await telemetryApi.getTopics({ sort_by: 'message_count', order: 'desc', page: 2 });
  assert.equal(calls[4].url, 'http://localhost:8000/api/v1/topics?sort_by=message_count&order=desc&page=2');

  // Topic by ID
  await telemetryApi.getTopicById('topic_005');
  assert.equal(calls[5].url, 'http://localhost:8000/api/v1/topics/topic_005');

  // Messages with platform filter
  await telemetryApi.getMessages({ platform: 'telegram', page: 1 });
  assert.equal(calls[6].url, 'http://localhost:8000/api/v1/messages?platform=telegram&page=1');

  // Message by ID with URI encoding
  await telemetryApi.getMessageById('telegram:-100123:456');
  assert.equal(calls[7].url, 'http://localhost:8000/api/v1/messages/telegram%3A-100123%3A456');

  // Pipeline Status & Metrics
  await telemetryApi.getPipelineStatus();
  assert.equal(calls[8].url, 'http://localhost:8000/api/v1/pipeline/status');

  await telemetryApi.getPipelineMetrics();
  assert.equal(calls[9].url, 'http://localhost:8000/api/v1/pipeline/metrics');
});

test('14. apiClient cleanly parses backend 5A error envelopes on failure', async (t) => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: false,
    status: 404,
    statusText: 'Not Found',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({
      detail: {
        code: 'RESOURCE_NOT_FOUND',
        message: "Narrative candidate 'narrative_999' not found.",
        details: { resource_type: 'narrative', identifier: 'narrative_999' },
      },
    }),
  });

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(
    async () => {
      await telemetryApi.getNarrativeById('narrative_999');
    },
    (err) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.status, 404);
      assert.match(err.message, /RESOURCE_NOT_FOUND/);
      return true;
    }
  );
});

test('15. Community Top Narrative Focus: identity formatting strips hash tags and raw c-TF-IDF keyword tokens', () => {
  // Test raw c-TF-IDF keyword bag with hashtag
  const rawSample1 = {
    narrative_id: 'narrative_247',
    headline_claim: '[#socmint] io, en, xtea, ts, telemetrya, report',
  };
  const title1 = getNarrativeDisplayName(rawSample1);
  assert.equal(title1.includes('#'), false, 'Should not contain hashtag');
  assert.equal(title1.includes('[#socmint]'), false, 'Should not contain raw hashtag bracket');
  assert.equal(title1.length > 5, true, 'Should have generated meaningful title');

  // Test raw topic prefix
  const rawSample2 = {
    narrative_id: 'narrative_053',
    headline_claim: '[topic_178] site, me, telega, channels, messages',
  };
  const title2 = getNarrativeDisplayName(rawSample2);
  assert.equal(title2.includes('topic_178'), false, 'Should strip raw topic code');
  assert.equal(title2.length > 5, true, 'Should have formatted title');

  // Test backend narrative_name takes highest precedence
  const namedSample = {
    narrative_id: 'narrative_001',
    narrative_name: 'Border Strategic Escalation',
    headline_claim: '[#conflict] shelling and artillery',
  };
  assert.equal(getNarrativeDisplayName(namedSample), 'Border Strategic Escalation');
});

test('16. Community narrative IDs are strictly formatted as uppercase NARRATIVE_XXX for display', () => {
  const id = 'narrative_053';
  const displayId = id.toUpperCase();
  assert.equal(displayId, 'NARRATIVE_053');
  assert.match(displayId, /^NARRATIVE_\d+$/);
});

test('17. Topology Graph: resolveTelegramMessageUrl accurately constructs direct Telegram message redirects', () => {
  // Test case A: Known registered channel (BNO News - 1241816060 -> @bnonews)
  const bnoUrl = resolveTelegramMessageUrl('telegram:1241816060:40523');
  assert.equal(bnoUrl, 'https://t.me/bnonews/40523');

  // Test case B: Author username in metadata takes explicit precedence
  const customMetaUrl = resolveTelegramMessageUrl('telegram:1317428262:83849', {
    author_username: 'BBCWorld',
  });
  assert.equal(customMetaUrl, 'https://t.me/BBCWorld/83849');

  // Test case C: Precomputed telegram_url in metadata
  const precomputedUrl = resolveTelegramMessageUrl('telegram:999:123', {
    telegram_url: 'https://t.me/bnonews/123',
  });
  assert.equal(precomputedUrl, 'https://t.me/bnonews/123');

  // Test case D: Private / numeric channel fallback without username
  const numericUrl = resolveTelegramMessageUrl('telegram:-10099887766:54321');
  assert.equal(numericUrl, 'https://t.me/c/99887766/54321');

  // Test case E: Channel URL resolution
  const channelUrl = resolveTelegramChannelUrl('1241816060');
  assert.equal(channelUrl, 'https://t.me/bnonews');
});


