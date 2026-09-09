export interface RegisteredChannel {
  id: string;
  title: string;
  handle: string;
  category: string;
  platform: 'telegram' | 'web' | 'x';
}

export const KNOWN_TELEGRAM_CHANNELS: Record<string, RegisteredChannel> = {
  '1317428262': {
    id: '1317428262',
    title: 'BBC News (World)',
    handle: '@bbcworld',
    category: 'News Syndicate',
    platform: 'telegram',
  },
  '1241816060': {
    id: '1241816060',
    title: 'BNO News',
    handle: '@bnonews',
    category: 'Breaking News',
    platform: 'telegram',
  },
  '2117353956': {
    id: '2117353956',
    title: 'Geopolitics Watch',
    handle: '@geopolitics_watch',
    category: 'Regional Monitor',
    platform: 'telegram',
  },
  '2126482678': {
    id: '2126482678',
    title: 'Ministry of Defence India 🇮🇳',
    handle: '@mod_india',
    category: 'Official State',
    platform: 'telegram',
  },
  '1633659700': {
    id: '1633659700',
    title: 'OSINTdefender',
    handle: '@osintdefender',
    category: 'Open Source Intelligence',
    platform: 'telegram',
  },
  '1011047399': {
    id: '1011047399',
    title: 'Reuters: World',
    handle: '@reutersworld',
    category: 'Global Wire',
    platform: 'telegram',
  },
  '1323386230': {
    id: '1323386230',
    title: 'Cyber Threat Intelligence',
    handle: '@cyberthreatintel',
    category: 'Cyber Defense',
    platform: 'telegram',
  },
  '1129491012': {
    id: '1129491012',
    title: 'CVE Notify',
    handle: '@cvenotify',
    category: 'Security Advisories',
    platform: 'telegram',
  },
  '1597138777': {
    id: '1597138777',
    title: 'Cyber Detective',
    handle: '@cyberdetective',
    category: 'OSINT & Cyber',
    platform: 'telegram',
  },
  '1007109764': {
    id: '1007109764',
    title: 'Liveuamap',
    handle: '@liveuamap',
    category: 'Conflict Mapping',
    platform: 'telegram',
  },
  '1888348357': {
    id: '1888348357',
    title: 'Major Madhan Kumar MMK',
    handle: '@majormadhankumar',
    category: 'Defense Analyst',
    platform: 'telegram',
  },
  '1009650918': {
    id: '1009650918',
    title: 'The Hacker News',
    handle: '@thehackernews',
    category: 'Infosec Media',
    platform: 'telegram',
  },
  '1625429257': {
    id: '1625429257',
    title: 'Global News Monitor',
    handle: '@globalnewsmonitor',
    category: 'Global Wire',
    platform: 'telegram',
  },
  '1554189930': {
    id: '1554189930',
    title: 'Kashmir Intel Wire',
    handle: '@kashmir_intel',
    category: 'Regional Broadcast',
    platform: 'telegram',
  },
  '2580964205': {
    id: '2580964205',
    title: 'Assam Rifles Brief',
    handle: '@assamrifles_brief',
    category: 'Security Feed',
    platform: 'telegram',
  },
  '1950487092': {
    id: '1950487092',
    title: 'Middle East & Global Wire',
    handle: '@meglobalwire',
    category: 'Syndication Feed',
    platform: 'telegram',
  },
  '2572679327': {
    id: '2572679327',
    title: 'Subcontinent Geopolitics',
    handle: '@subcontinent_geo',
    category: 'Strategic Analysis',
    platform: 'telegram',
  },
  '1964457167': {
    id: '1964457167',
    title: 'Defense Dispatch',
    handle: '@defensedispatch',
    category: 'Tactical Feed',
    platform: 'telegram',
  },
};

export function resolveChannelInfo(rawId: string): RegisteredChannel {
  const cleanId = rawId.trim().replace(/^telegram:/, '').replace(/^@/, '');
  if (KNOWN_TELEGRAM_CHANNELS[cleanId]) {
    return KNOWN_TELEGRAM_CHANNELS[cleanId];
  }

  // Handle domain entities (e.g. "domain:bbc.com" or "bbc.com")
  if (cleanId.startsWith('domain:') || cleanId.includes('.')) {
    const domain = cleanId.replace('domain:', '');
    return {
      id: cleanId,
      title: domain.charAt(0).toUpperCase() + domain.slice(1),
      handle: domain,
      category: 'Web Source / Domain',
      platform: 'web',
    };
  }

  // Handle hashtag entities
  if (cleanId.startsWith('hashtag:') || cleanId.startsWith('#')) {
    const tag = cleanId.replace('hashtag:', '#');
    return {
      id: cleanId,
      title: tag,
      handle: tag,
      category: 'Hashtag Campaign',
      platform: 'x',
    };
  }

  // Fallback for numeric or custom channel identifier
  return {
    id: cleanId,
    title: `Feed @${cleanId.slice(0, 10)}`,
    handle: `@${cleanId}`,
    category: 'Broadcaster Feed',
    platform: 'telegram',
  };
}

/**
 * Resolves the exact direct Telegram URL for a message from its canonical ID and optional metadata.
 * 
 * Priority resolution:
 * 1. Direct `telegram_url` already present in metadata
 * 2. Public handle in metadata (`author_username`) + message ID
 * 3. Registered channel handle from KNOWN_TELEGRAM_CHANNELS + message ID
 * 4. Deep link format: `https://t.me/c/{clean_chat_id}/{message_id}`
 */
export function resolveTelegramMessageUrl(
  canonicalId?: string,
  metadata?: Record<string, unknown>
): string | null {
  // 1. Direct telegram_url in metadata
  if (
    metadata?.telegram_url &&
    typeof metadata.telegram_url === 'string' &&
    metadata.telegram_url.startsWith('http')
  ) {
    return metadata.telegram_url;
  }

  // 2. Extract from canonical_id or raw ID
  const rawId = (canonicalId || (metadata?.canonical_id as string) || '').trim();
  const cleanId = rawId.replace(/^message:/, '');
  const parts = cleanId.split(':');

  if (parts.length >= 3 && parts[0] === 'telegram') {
    const chatId = parts[1];
    const messageId = parts[2];

    // Check author_username in metadata
    if (metadata?.author_username && typeof metadata.author_username === 'string') {
      const handle = metadata.author_username.replace(/^@/, '').trim();
      if (handle) {
        return `https://t.me/${handle}/${messageId}`;
      }
    }

    // Check known channel registry
    const channelInfo = resolveChannelInfo(chatId);
    if (
      channelInfo &&
      channelInfo.handle &&
      channelInfo.handle.startsWith('@') &&
      !channelInfo.title.startsWith('Feed @')
    ) {
      const handle = channelInfo.handle.replace(/^@/, '').trim();
      if (handle) {
        return `https://t.me/${handle}/${messageId}`;
      }
    }

    // Fallback to internal/supergroup link
    const cleanChat = chatId.replace(/^-100/, '').replace(/^-/, '').trim();
    if (cleanChat && messageId) {
      return `https://t.me/c/${cleanChat}/${messageId}`;
    }
  }

  return null;
}

/**
 * Resolves the direct Telegram URL for a channel/source.
 */
export function resolveTelegramChannelUrl(
  channelId?: string,
  metadata?: Record<string, unknown>
): string | null {
  if (
    metadata?.telegram_url &&
    typeof metadata.telegram_url === 'string' &&
    metadata.telegram_url.startsWith('http')
  ) {
    return metadata.telegram_url;
  }

  const rawId = (channelId || (metadata?.author_id as string) || '').trim();
  const cleanId = rawId.replace(/^channel:/, '').replace(/^telegram:/, '');

  if (metadata?.author_username && typeof metadata.author_username === 'string') {
    const handle = metadata.author_username.replace(/^@/, '').trim();
    if (handle) return `https://t.me/${handle}`;
  }

  const channelInfo = resolveChannelInfo(cleanId);
  if (
    channelInfo &&
    channelInfo.handle &&
    channelInfo.handle.startsWith('@') &&
    !channelInfo.title.startsWith('Feed @')
  ) {
    const handle = channelInfo.handle.replace(/^@/, '').trim();
    if (handle) return `https://t.me/${handle}`;
  }

  const cleanChat = cleanId.replace(/^-100/, '').replace(/^-/, '').trim();
  if (cleanChat && /^\d+$/.test(cleanChat)) {
    return `https://t.me/c/${cleanChat}`;
  }

  return null;
}

