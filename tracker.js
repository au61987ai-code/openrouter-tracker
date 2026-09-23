/**
 * OpenRouter Tracker - 24/7 Cloud Automated Monitoring Script
 * Executed via GitHub Actions or local Node.js process.
 */

const fs = require('fs');
const path = require('path');

const SNAPSHOT_FILE = path.join(__dirname, 'snapshot.json');
const HISTORY_FILE = path.join(__dirname, 'change_history.json');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
const ONLY_HIKES = process.env.ONLY_HIKES === 'true' || process.env.ONLY_HIKES === '1';

// Outlier Filter Parameters
const OUTLIER = {
  enabled: true,
  minPrice: 0,
  maxPrice: 10000,
  maxDiff: 1000
};

function isAnomaly(promptPerM, compPerM, diff = 0) {
  if (isNaN(promptPerM) || isNaN(compPerM)) return true;
  if (promptPerM < 0 || compPerM < 0) return true;
  if (!OUTLIER.enabled) return false;
  if (promptPerM < OUTLIER.minPrice || promptPerM > OUTLIER.maxPrice) return true;
  if (compPerM < OUTLIER.minPrice || compPerM > OUTLIER.maxPrice) return true;
  if (Math.abs(diff) > OUTLIER.maxDiff) return true;
  return false;
}

function loadJSON(filePath, fallback = {}) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error(`[Error] Failed to read ${filePath}:`, e.message);
  }
  return fallback;
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`[Error] Failed to save ${filePath}:`, e.message);
  }
}

async function sendDiscordNotification(events) {
  if (!DISCORD_WEBHOOK_URL) {
    console.log('[Notice] DISCORD_WEBHOOK_URL environment variable is not set. Discord notification skipped.');
    return;
  }

  // Default target events: PRICE_HIKE (調漲), PRICE_DROP (調降), NEW_MODEL (新模型上架)
  let filteredEvents = events.filter(e => 
    e.changeType === 'PRICE_HIKE' || 
    e.changeType === 'PRICE_DROP' || 
    e.changeType === 'NEW_MODEL'
  );

  if (ONLY_HIKES) {
    filteredEvents = events.filter(e => e.changeType === 'PRICE_HIKE');
    console.log(`[Filter] ONLY_HIKES enabled. Filtered ${events.length} events down to ${filteredEvents.length} hikes.`);
  }

  if (filteredEvents.length === 0) {
    const isManualRun = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' || process.env.FORCE_ALERT === 'true';
    if (isManualRun) {
      console.log('[Notice] Manual trigger detected. Sending status report embed to Discord...');
      const payload = {
        username: "OpenRouter Price Tracker Bot",
        avatar_url: "https://openrouter.ai/favicon.ico",
        content: "🤖 **[手動觸發檢查報告] OpenRouter 監控狀態回報**",
        embeds: [
          {
            title: "🔍 雲端排程連線掃描完成",
            description: `已成功連線 OpenRouter 官方 API 並對比模型價格。`,
            color: 3900150,
            fields: [
              { name: "異動狀態", value: "🟢 目前全站價格平穩 (此時段無新調漲/調降)", inline: true },
              { name: "掃描時間", value: new Date().toLocaleString('zh-TW', { hour12: false }), inline: true }
            ],
            footer: { text: "OpenRouter Tracker Alert Engine • 手動觸發報告" }
          }
        ]
      };
      try {
        await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        console.log('[Success] Manual status report sent to Discord.');
      } catch(e) {
        console.error('[Error] Manual status report fetch error:', e.message);
      }
    } else {
      console.log('[Notice] No target events (hikes/drops/new models) to notify after filtering.');
    }
    return;
  }

  const embeds = filteredEvents.slice(0, 10).map(evt => {
    let color = 3900150; // Blue
    let emoji = '⚡';
    let typeName = '異動通知';

    if (evt.changeType === 'PRICE_HIKE') {
      color = 15685220; // Red #ef4444
      emoji = '📈';
      typeName = '價格調漲警告 (PRICE HIKE)';
    } else if (evt.changeType === 'PRICE_DROP') {
      color = 1095941; // Green #10b981
      emoji = '📉';
      typeName = '價格調降優惠 (PRICE DROP)';
    } else if (evt.changeType === 'NEW_MODEL') {
      color = 3900150; // Blue #3b82f6
      emoji = '✨';
      typeName = '新模型發布上架 (NEW MODEL)';
    } else if (evt.changeType === 'REMOVED') {
      color = 7041664; // Gray #6b7280
      emoji = '⚠️';
      typeName = '模型下架通知 (REMOVED)';
    }

    const modelUrl = `https://openrouter.ai/${evt.modelId.split(':')[0]}`;

    return {
      title: `${emoji} ${typeName} - ${evt.modelName || evt.modelId}`,
      url: modelUrl,
      color: color,
      description: `**${evt.fieldName || evt.field || '狀態'}**: \`${evt.oldVal}\` ➔ **\`${evt.newVal}\`** (${evt.diffStr || ''} ${evt.percentStr || ''})`,
      fields: [
        { name: "Model ID", value: `\`${evt.modelId}\``, inline: true },
        { name: "供應商 Provider", value: evt.provider || 'Other', inline: true },
        { name: "檢測時間", value: evt.timeStr || new Date().toLocaleString('zh-TW'), inline: true }
      ],
      footer: { text: "OpenRouter Price Tracker • GitHub Actions Automated Alert" }
    };
  });

  const payload = {
    username: "OpenRouter Price Tracker Bot",
    avatar_url: "https://openrouter.ai/favicon.ico",
    content: `🚨 **[GitHub 雲端排程警報] 檢測到 ${filteredEvents.length} 筆 OpenRouter 模型異動！**`,
    embeds: embeds
  };

  try {
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      console.log(`[Success] Discord Webhook alert sent for ${filteredEvents.length} events.`);
    } else {
      console.error(`[Error] Discord Webhook responded with HTTP ${res.status}`);
    }
  } catch (err) {
    console.error('[Error] Failed to post Discord Webhook:', err.message);
  }
}

async function runTracker() {
  console.log('====================================================');
  console.log('🚀 OpenRouter Tracker - 24/7 Cloud Automated Monitoring');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('====================================================');

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models');
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
    const data = await response.json();

    if (!data || !Array.isArray(data.data)) {
      throw new Error('API response format invalid');
    }

    const newModelsList = data.data;
    console.log(`[API] Successfully fetched ${newModelsList.length} models from OpenRouter.`);

    const prevSnapshot = loadJSON(SNAPSHOT_FILE, { models: {} });
    const prevModelsMap = prevSnapshot.models || {};
    let changeEvents = loadJSON(HISTORY_FILE, []);

    const now = new Date();
    const timestamp = now.getTime();
    const timeStr = now.toLocaleString('zh-TW', { hour12: false });

    const newEvents = [];
    const currentModelsMap = {};

    newModelsList.forEach(m => {
      const prev = prevModelsMap[m.id];
      const promptPrice = parseFloat(m.pricing?.prompt || '0');
      const compPrice = parseFloat(m.pricing?.completion || '0');
      const promptPerM = promptPrice * 1000000;
      const compPerM = compPrice * 1000000;

      let lastUpdated = timestamp;
      let lastUpdatedStr = timeStr;
      let lastChangeReason = '初次收錄';
      let firstSeen = timestamp;

      if (!prev) {
        lastChangeReason = '新模型上架';
        if (Object.keys(prevModelsMap).length > 0) {
          newEvents.push({
            id: `evt_${timestamp}_${Math.random().toString(36).substr(2, 6)}`,
            timestamp: timestamp,
            timeStr: timeStr,
            modelId: m.id,
            modelName: m.name || m.id,
            provider: m.id.split('/')[0] || 'other',
            changeType: 'NEW_MODEL',
            field: 'status',
            oldVal: '未收錄',
            newVal: '新上架',
            diffStr: '全新發布',
            percentStr: ''
          });
        }
      } else {
        firstSeen = prev.first_seen || prev.last_updated || timestamp;
        lastUpdated = prev.last_updated || timestamp;
        lastUpdatedStr = prev.last_updated_str || timeStr;
        lastChangeReason = prev.last_change_reason || '已確認最新';

        const prevPromptPerM = prev.prompt_price * 1000000;
        const prevCompPerM = prev.completion_price * 1000000;

        // Check Prompt Price Change
        if (Math.abs(promptPerM - prevPromptPerM) > 0.0001) {
          const diff = promptPerM - prevPromptPerM;
          if (!isAnomaly(promptPerM, compPerM, diff)) {
            const pct = prevPromptPerM > 0 ? ((diff / prevPromptPerM) * 100).toFixed(1) : 0;
            const isDrop = diff < 0;
            lastChangeReason = isDrop ? '價格調降 📉' : '價格調漲 📈';

            newEvents.push({
              id: `evt_${timestamp}_${Math.random().toString(36).substr(2, 6)}`,
              timestamp: timestamp,
              timeStr: timeStr,
              modelId: m.id,
              modelName: m.name || m.id,
              provider: m.id.split('/')[0] || 'other',
              changeType: isDrop ? 'PRICE_DROP' : 'PRICE_HIKE',
              field: 'prompt_price',
              fieldName: '輸入價格 (Prompt)',
              oldVal: `$${prevPromptPerM.toFixed(4)}`,
              newVal: `$${promptPerM.toFixed(4)}`,
              diffStr: `${diff > 0 ? '+' : ''}$${diff.toFixed(4)}`,
              percentStr: `${pct > 0 ? '+' : ''}${pct}%`
            });
          }
        }

        // Check Completion Price Change
        if (Math.abs(compPerM - prevCompPerM) > 0.0001) {
          const diff = compPerM - prevCompPerM;
          if (!isAnomaly(promptPerM, compPerM, diff)) {
            const pct = prevCompPerM > 0 ? ((diff / prevCompPerM) * 100).toFixed(1) : 0;
            const isDrop = diff < 0;
            lastChangeReason = isDrop ? '價格調降 📉' : '價格調漲 📈';

            newEvents.push({
              id: `evt_${timestamp}_${Math.random().toString(36).substr(2, 6)}`,
              timestamp: timestamp,
              timeStr: timeStr,
              modelId: m.id,
              modelName: m.name || m.id,
              provider: m.id.split('/')[0] || 'other',
              changeType: isDrop ? 'PRICE_DROP' : 'PRICE_HIKE',
              field: 'completion_price',
              fieldName: '輸出價格 (Completion)',
              oldVal: `$${prevCompPerM.toFixed(4)}`,
              newVal: `$${compPerM.toFixed(4)}`,
              diffStr: `${diff > 0 ? '+' : ''}$${diff.toFixed(4)}`,
              percentStr: `${pct > 0 ? '+' : ''}${pct}%`
            });
          }
        }
      }

      currentModelsMap[m.id] = {
        id: m.id,
        name: m.name,
        created: m.created,
        prompt_price: promptPrice,
        completion_price: compPrice,
        context_length: m.context_length || 0,
        modalities: m.architecture?.modality || '',
        description: m.description || '',
        last_updated: lastUpdated,
        last_updated_str: lastUpdatedStr,
        last_change_reason: lastChangeReason,
        first_seen: firstSeen
      };
    });

    // Check Removed Models
    for (const [id, prev] of Object.entries(prevModelsMap)) {
      if (!currentModelsMap[id]) {
        newEvents.push({
          id: `evt_${timestamp}_${Math.random().toString(36).substr(2, 6)}`,
          timestamp: timestamp,
          timeStr: timeStr,
          modelId: id,
          modelName: prev.name || id,
          provider: id.split('/')[0] || 'other',
          changeType: 'REMOVED',
          field: 'status',
          oldVal: '上線中',
          newVal: '已下架',
          diffStr: '已移出目錄',
          percentStr: ''
        });
      }
    }

    // Save updated snapshot
    saveJSON(SNAPSHOT_FILE, {
      savedAt: timeStr,
      timestamp: timestamp,
      models: currentModelsMap
    });

    if (newEvents.length > 0) {
      console.log(`[Diff] Detected ${newEvents.length} real change events! Writing to change_history.json...`);
      changeEvents = [...newEvents, ...changeEvents];
      saveJSON(HISTORY_FILE, changeEvents);

      // Trigger Discord Alert
      await sendDiscordNotification(newEvents);
    } else {
      console.log('[Diff] No price or model changes detected in this run.');
    }

    console.log('✅ OpenRouter Tracker run completed successfully.');
  } catch (err) {
    console.error('❌ Error running tracker:', err);
    process.exit(1);
  }
}

runTracker();
