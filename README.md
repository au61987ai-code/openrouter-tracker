# OpenRouter Model & Price Tracker (24/7 Cloud Automated Edition)

> 🚀 **全自動線上 24/7 模型價格波動與異動追蹤系統**  
> 結合 **GitHub Actions 自動雲端輪詢** + **Discord 原生彩色警報 Embeds** + **GitHub Pages 靜態儀表板**。  
> **電腦關機、手機關機，雲端一樣 24 小時無人值守追蹤！**

---

## 🌟 核心特色與架構

```mermaid
flowchart TD
    GHA["☁️ GitHub Actions (每 30 分鐘免費 Cron 排程)"] -->|抓取| API["🌐 OpenRouter Official API"]
    GHA -->|對比快照| DIFF{"檢查是否有異動/調漲?"}
    DIFF -->|是 (PRICE_HIKE / DROP)| DC["👾 Discord Webhook (發送彩色 Embeds 警報)"]
    DIFF -->|儲存| DB["💾 Git 自動提交 snapshot.json & change_history.json"]
    DB -->|託管發布| GHP["🌐 GitHub Pages (全方位前端追蹤儀表板)"]
```

1. **24/7 免費雲端排程 (GitHub Actions)**：
   - 每 30 分鐘雲端自動抓取 OpenRouter 全站 450+ 款 AI 模型。
   - 自動過濾雜訊與極端異常數據（Anomaly Filter）。
2. **👾 Discord Webhook 原生彩色 Embeds**：
   - 漲價時自動發送 **赤紅色 (PRICE HIKE) 警告卡片**。
   - 降價時發送 **翡翠綠 (PRICE DROP) 優惠卡片**。
   - 新模型上架發送 **紫藍色 (NEW MODEL) 發布卡片**。
3. **📊 精美雙視角儀表板 (openrouter-tracker.html)**：
   - 客觀 6 階價格定位 (L0~L5)、歷史最低價 (ATL) 識別。
   - 互動式 SVG 價格走勢圖與懸停動態時間軸。

---

## 🚀 3 步驟快速設定 (3-Minute Setup Guide)

### 第一步：建立 GitHub Repository 並上傳專案
將本專案目錄推送到您的 GitHub 儲存庫：

```bash
git init
git add .
git commit -m "feat: initial commit for OpenRouter 24/7 tracker"
git branch -M main
git remote add origin https://github.com/您的帳號/openrouter-tracker.git
git push -u origin main
```

---

### 第二步：設定 Discord Webhook 密鑰 (GitHub Secret)

1. 開啟您的 GitHub 專案頁面 ➔ 點擊 **`Settings`**。
2. 左側選單點擊 **`Secrets and variables`** ➔ **`Actions`**。
3. 點擊 **`New repository secret`**：
   - **Name**: `DISCORD_WEBHOOK_URL`
   - **Secret**: 貼上您的 Discord Webhook 網址（例如 `https://discord.com/api/webhooks/...`）
4. *(選擇性)* 如果只想在漲價時接收警報：
   - 點擊 **`Variables`** 頁籤 ➔ **`New repository variable`**：
     - **Name**: `ONLY_HIKES`
     - **Value**: `true`

---

### 第三步：開啟 GitHub Pages 免費託管網頁

1. 在 GitHub 專案頁面點擊 **`Settings`** ➔ 左側點擊 **`Pages`**。
2. 在 **Build and deployment** 下方的 **Source** 選擇 **`Deploy from a branch`**。
3. Branch 選擇 **`main`** / `/ (root)`，點擊 **Save**。
4. 幾分鐘後，您即可透過 `https://您的帳號.github.io/openrouter-tracker/openrouter-tracker.html` 隨時隨地用手機或電腦查看最新的模型價格走勢！

---

## 🧪 本地手動執行測試

若您想在電腦上立即測試抓取與發送：

```bash
# 1. 設定環境變數 (Windows PowerShell)
$env:DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/YOUR_WEBHOOK_URL"

# 2. 執行監控腳本
node tracker.js
```

---

## 📁 檔案結構

```
├── .github/workflows/
│   └── tracker.yml         # GitHub Actions 24/7 自動排程配置文件 (Cron 30m)
├── tracker.js              # Node.js 雲端異動比對與 Discord 推播核心腳本
├── openrouter-tracker.html # 前端互動儀表板 (價格階層/走勢圖/篩選)
├── snapshot.json           # 模型價格最新快照 (自動跟新)
├── change_history.json     # 異動歷史資料庫 (自動更新)
├── index.html              # 系統入口首頁
└── comparison.html         # 2026 AI 閘道評測儀表板
```
