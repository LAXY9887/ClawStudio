# Ad Networks Comparison Reference

> **⚠️ 歷史研究文件（2026-04 製作）。**
> ClawStudio 目前的廣告策略已收斂為**僅使用 Google AdSense**。Monetag、Adsterra 及其他第三方廣告網路均已棄用且不會重新導入。
> 本文件保留作為廣告生態研究的歷史紀錄，**不代表現行策略**。實際的廣告整合請見 [ad-integration.md](./ad-integration.md)。

廣告網路選擇參考文件，依「月流量門檻」分組。針對 ClawStudio（工具型網站，月流量起步階段）的策略選擇而整理。

**最後更新：** 2026-04-30（此後策略已調整，見上方警示）
**資訊來源：** 各網路官方支援文件 + 2026 年產業 review 文章（見底部 Sources）

---

## TL;DR — 工具站策略

| 階段 | 流量 | 建議廣告網路 |
|---|---|---|
| **起步** | < 10K 月 PV | ~~Monetag + Adsterra~~（已棄用，不再採用第三方廣告網路） |
| **成長** | 10K–50K 月 PV | 加 Monumetric |
| **穩定** | 50K+ 月 sessions | 評估 Mediavine（要轉內容站） |
| **規模化** | 100K+ 月 PV + blog 內容 | 重啟 AdSense / Clickio / Raptive / Ezoic |

**重點原則：**
- 多家並行（mediation）通常比單押一家收益高 30-50%
- 工具站 RPM 結構性低於內容站，不要追求單一「最高 RPM」廣告商
- AdSense 不是必經之路，工具站經常跳過

---

## 無門檻廣告網路（適合起步）

| 廣告網路 | 內容門檻 | 工具站友好度 | RPM 級距 | 備註 |
|---|---|---|---|---|
| **Google AdSense** | ⚠️ 嚴格內容質量審查 | ❌ 純工具站難過審 | $5–20 | 「缺乏價值內容」是常見拒絕理由；要有真內容（blog）支援 |
| **Monetag**（前 PropellerAds） | 無 | ✅ | $1–5 | 即時批准；多元廣告格式（push、interstitial、native）；~~ClawStudio 主力~~ **已棄用** |
| **Adsterra** | 無 | ✅ | $1–5 | 1-2 天批准；display / native / popup / social bar；接受工具站；**已棄用** |
| **PopAds** | 無 | 🟡 | $1–3 | Pop-under only，UX 侵入性強，不建議當主力 |
| **PopCash** | 無 | 🟡 | $1–3 | Pop-under 為主，日結，門檻 $10 |
| **ExoClick** | 無 | ⚠️ | $1–4 | 接受工具站但廣告主池偏成人/博弈，**有品牌風險** |
| **Hilltopads** | 無 | ✅ | $1–5 | Pop-under 專長，工具站常見搭配 |

### ~~推薦組合：Monetag + Adsterra~~（歷史紀錄）

> **此節為歷史研究階段的構想，不代表 ClawStudio 現行策略。**
> 兩家原本都允許並行（不要求獨家），可做 ad mediation，整體 fill rate 與 RPM 比單跑高 30-50%。

> **ClawStudio 現況（2026-05）**：Monetag、Adsterra 及所有第三方廣告網路已**永久棄用**並從程式碼中完整移除。專案僅保留 Google AdSense 的基礎架構（`adsenseEnabled: false`，待 Google 審核通過後啟用），不再考慮回頭整合其他網路。

---

## 低門檻廣告網路（10K-50K 月流量）

| 廣告網路 | 月流量門檻 | 內容要求 | 工具站友好度 | RPM 級距 | 備註 |
|---|---|---|---|---|---|
| **Monumetric** | 10,000 月 PV（Propel tier） | 中 | ✅ | $5–12 | $99 一次性 setup fee；比 Monetag/Adsterra 「正規」很多；有後續分級制 |
| **Setupad** | 通常 100K+（彈性審核） | 中 | 🟡 | $5–15 | Header bidding 服務；門檻偏高，更適合中型站 |

---

## 高門檻廣告網路（50K+ 月流量，內容站優先）

| 廣告網路 | 月流量門檻 | 內容要求 | 工具站友好度 | RPM 級距 | 備註 |
|---|---|---|---|---|---|
| **Clickio** | 無硬門檻，實務 100K+ PV | 中 | 🟡 | $5–20 | Google Certified Publishing Partner；接 Google AdX；三大 premium 中**對工具站最寬容** |
| **Mediavine** | **50,000 月 sessions**（≈ 75–100K PV） | 嚴 | ❌ | $15–40 | 內容站優先，工具站過審機率 < 30% |
| **Raptive**（前 AdThrive） | **100,000 月 PV** | 嚴 | ❌ | $20–50 | 偏好 US/CA/UK/AU 流量；blog / 食譜 / 旅遊類最受歡迎；工具站幾乎不收 |
| **Ezoic** | **250,000 月活躍用戶**（2026/2/19 起） | 寬（接受工具站） | ✅ | $5–15 | **政策變更：原本無門檻，2026/2/19 後改成 250K**；2/19 前加入者 grandfather（連續使用，不可停超過 7 天）；新註冊網站需符合新門檻 |

### Ezoic 政策變更要點（2026/2/19）

- 新註冊：**必須 250K 月活躍用戶**才能加入
- 既有用戶：grandfathered（保留原 access），但**停用超過 7 天就失效**，重新加入要符合 250K
- 加在現有帳號的新網站：一律要 250K
- 工具站沒有「必須有 blog」要求，但前提是先過 250K 門檻
- **網路上多數 review 文章還在引用舊政策（「無門檻」），參考時注意日期**

---

## 廣告網路類型對照

### 依廣告主類型

- **CPM 高的（內容站親和）**：AdSense、Mediavine、Raptive、Clickio、Monumetric、Ezoic
- **CPM 低但工具站親和**：Monetag、Adsterra、Hilltopads、PopAds

### 依廣告格式

- **Display banner / native**：AdSense、Ezoic、Mediavine、Raptive、Clickio、Adsterra、Monumetric
- **Pop-under / interstitial**：Monetag、Adsterra、PopAds、PopCash、Hilltopads、ExoClick
- **Push notification**：Monetag、Adsterra（注意：須遵循 GDPR / 用戶授權）
- **Header bidding**：Setupad、Ezoic、Mediavine、Raptive、Clickio

### 依品牌風險

- **乾淨**：AdSense、Ezoic、Mediavine、Raptive、Clickio、Monumetric
- **中性**：Monetag、Adsterra、Hilltopads、Setupad
- **偏向成人/博弈**：ExoClick、PopAds、PopCash（廣告主池質量參差）

---

## 工具站特殊考量

### 為什麼工具站 RPM 普遍低於內容站

工具站使用者 intent 是「快進快出」，廣告主在競價時對這種流量出價較低（沒有「停留閱讀文章 + 被推薦相關產品」的轉換空間）。所以即使工具站過審 AdSense，RPM 通常比相同流量的內容站低 30-50%。

### 「塞 SEO 廢話」是反模式

工具類查詢（"png to gif converter"）的 Google ranking signal 是**完成任務的能力**，不是文章長度。SEO 段落應該包含：
- 真的有資訊量的（用法說明、格式比較、技術 FAQ）
- JSON-LD schema、heading 結構、meta description（搜尋引擎要的結構性內容）

**不該為了 AdSense 審核而堆砌大量「Why」「How」段落** — 反而傷品牌、可能被當 thin content。

### 多網路並行（Ad Mediation）的價值

- 不同廣告網路有不同 demand pool，並行可提高 fill rate
- 同一個版位可以 fallback：A 沒填單就 B 接手
- ClawStudio 目前暫停所有第三方廣告，待流量成長再重新接入
- 注意：**AdSense 要求 ad placement 不能與其他「類似 AdSense」的網路重疊**（例如同個版位放 Ezoic + AdSense）— 但跟 Monetag/Adsterra 這類非 GAM 網路並行 OK

---

## 申請 SOP

### Adsterra（最近一個可申請的）

1. https://adsterra.com/ → Become Publisher
2. 填表（網站 URL、流量估計、廣告類型偏好）
3. 1-2 天人工審核（自動拒絕的常見原因：網站無內容、有違規內容、流量造假）
4. 通過後到 dashboard 拿 publisher ID 與 ad zone code
5. 整合到網站（同 Monetag 的整合方式）

### Monumetric（流量達 10K 月 PV 後）

1. https://monumetric.com/become-a-publisher/
2. 表單（網站 URL、流量、Google Analytics 連結）
3. 人工審核 + 顧問通話（標準流程，他們會幫你規劃版位）
4. $99 setup fee
5. 整合：他們提供客製腳本，需安裝後等 24-48 小時 inventory 起來

### Mediavine（流量達 50K 月 sessions 後）

1. https://www.mediavine.com/apply/
2. 嚴格審查（內容質量、品牌、流量歷史、廣告主友好度）
3. 人工審核 1-2 週
4. 通過後客戶經理一對一 onboarding
5. 工具站建議**先在 /blog 放 30+ 篇真實長文**再申請

---

## 不建議的選項

| 廣告網路 | 不建議理由 |
|---|---|
| **PopAds / PopCash 當主力** | 純 pop-under 對 UX 破壞性強，會傷自然流量回流 |
| **ExoClick** | 廣告主池質量問題，不適合品牌經營型網站 |
| **任何要求獨家性的小網路** | 鎖定後反而限制成長 |

---

## 參考來源

- [Ezoic Official Requirements](https://support.ezoic.com/kb/article/getting-started-ezoics-requirements?id=getting-started-ezoics-requirements&lang=en-US) — 2026/2/19 政策更新
- [Ad Networks with No Minimum Traffic Requirements (smallsiteads.com)](https://smallsiteads.com/resources/no-minimum-traffic-networks)
- [Best Ad Networks for Small Publishers 2026 (cropink.com)](https://cropink.com/best-ad-networks-for-small-publishers)
- [14 Best Ad Networks For Publishers In 2026 (Adsterra blog)](https://adsterra.com/blog/best-ad-networks/)
- [Ezoic vs Mediavine vs Publift: Who Pays Better in 2026?](https://www.publift.com/blog/ezoic-vs-mediavine-vs-publift)
- [Ezoic Requirements 2026 (roihacks.com)](https://roihacks.com/ezoic-requirements/)

---

## 建議閱讀

- `docs/ad-integration.md` — ClawStudio AdSense 整合架構（目前唯一啟用的廣告系統）
- `docs/disabling-monetag-push.md` — Monetag push 退場流程（歷史文件）
