# PRD: Pro 多环扩散探索（Radial Explore）

- 状态: Draft
- 作者: Planning Agent
- 日期: 2026-05-14
- 关联模块: `MapViewModel.exploreNearby`, `AIService.synthesizeExperiences`, `OverpassService.fetchPOIs`, `SubscriptionService`
- Phase: Post-MVP / Pro Differentiation

---

## 1. 产品目标

让 Pro 用户在同一次 Explore Here 操作中"看得更远、发现得更多"——通过多环扩散（1.5km → 12km）一次性铺满一片可见地图，把 Pro 与 Free 的体验差异从"能不能用 AI"升级为"AI 能为我打开多大的世界"，强化付费留存与续订动机。

## 2. 背景与问题

当前 `exploreNearby(at:radiusMeters:3000)` 对 Free 和 Pro 用户的行为差异仅在于：

- Free: 走 skeleton 渲染，无 AI 文案
- Pro: 走 Anthropic/DeepSeek synthesis，AI 富化文案

**两者都只探一个 3km 单环、最多 15 个 POI**。Pro 用户付费后获得的"AI 文案"是单点价值，缺乏可感知的"探索半径/广度"差异化——付费心智弱，难以回答"会员每次 Explore 比免费多了什么具体的东西"。

## 3. 核心方案

### 3.1 多环参数

| 环  | 半径   | 预期 POI 量 | 用途              |
| --- | ------ | ----------- | ----------------- |
| R1  | 1.5 km | ~15         | 步行可达的近场    |
| R2  | 3 km   | ~15         | 当前默认体验区    |
| R3  | 6 km   | ~15         | 短途打车/骑行     |
| R4  | 12 km  | ~15         | 半日探索/郊区景观 |

**为什么是 4 环 / 1.5-3-6-12 几何级数**：

- 几何级数让每环面积约 4 倍递增，新增 POI 与已有环重叠最小
- 12km 覆盖到大多数城市的近郊景区与小众街区，是"会员特权"心智的甜点位
- 4 环是端到端总耗时（Overpass 串行/并行 + synthesis）和电量/数据流量的合理上限

**替代方案**：3 环（2/5/10km）成本低 25%，但 12km 那一环是付费用户最有"惊喜感"的——砍掉会损害差异化。后续可做 A/B。

### 3.2 每环行为

1. 独立 Overpass 查询（4 个环 key 互不相同，复用 OverpassService 既有缓存）
2. POI 去重（osmId 级别，外环剔除已在内环出现的节点）
3. 进入 AI synthesis（配额策略见 §4）
4. 生成的 Experience 按 `experience.id` 去重后合并进 `experienceService.appendGenerated`
5. 单环失败不影响其他环，仅在 UI 标注降级（见 §5）

### 3.3 Free vs Pro 对比

| 维度                    | Free (now)    | Pro (now) | Pro (本 PRD 后)               |
| ----------------------- | ------------- | --------- | ----------------------------- |
| 探索半径                | 3 km          | 3 km      | **1.5 / 3 / 6 / 12 km**       |
| POI 上限/次             | 15            | 15        | **~60（多环聚合后）**         |
| AI synthesis 调用       | 0             | 1         | **1（共享，见 §4 推荐方案）** |
| 单次平均加载 Experience | ≤15           | ≤15       | **30–50（去重后）**           |
| 触发频率限制            | 不限（无 AI） | 30/日     | **30/日（不变）**             |

## 4. 配额冲突分析（关键决策）

### 4.1 冲突陈述

当前 Pro 日 synthesis 配额 `dailySynthesisQuota = 30`。若多环各自调用一次 synthesis，则每次 Explore 消耗 4 次 → **Pro 每天仅能 Explore 7 次**。考虑到 Pro 用户的典型使用场景（搜索新城、反复换位置、调整地图视野），7 次远低于实际期望（参考 Free 用户当前 Explore 频次中位数）。

### 4.2 选项

**选项 A：提高 Pro 配额到 100/天**

- 优点：实现最简单，保持每环独立 prompt 的精细度
- 缺点：AI token 成本线性 4x；30/日是基于 DeepSeek 价格做的预算锚点，4x 会显著抬高单 Pro 用户的边际成本，对低 ARPU 月订阅不友好
- 复杂度：S（仅改常量）

**选项 B：多环共享一次 synthesis（推荐）✓**

- 实现：先并行/串行跑 4 环 Overpass，去重得到合并 POI 列表（上限调整为 ~60，即 `synthesisLimit = 60`），然后**一次** prompt 把整个列表交给模型
- 优点：
  - 配额消耗与现状一致（1 次/Explore），Pro 日上限仍是 30 次 Explore
  - 单次 prompt 体积变大但仍在 DeepSeek 上下文预算内（60 个 POI 的紧凑表示 ~3-5K tokens）
  - 模型能跨环看到分布，输出的 oneLiner 和 whyItMatters 可以体现"近场 vs 远场"的对照
- 缺点：
  - prompt 变长，单次延迟从 ~2s 提到 ~4-6s；需要 UI loading 状态更明显（见 §5）
  - synthesis 失败时，60 个 POI 一起降级到 skeleton——单次失败爆炸半径变大；缓解：保留 Overpass 缓存，重试时跳过缓存命中的环
- 复杂度：M（需要改 `synthesisLimit`、prompt 模板提示"按距离分组"、Overpass 并行调度）

**选项 C：保持 30/日，UI 显式倒计时**

- 实现：维持每环独立 synthesis；在按钮上显示"剩余 7 次 Explore"
- 优点：透明、模型质量不受 prompt 膨胀影响
- 缺点：7 次/日太少，会变相鼓励 Pro 用户"节省"使用——与"放心探索"的产品心智相反；客服压力增加
- 复杂度：S

### 4.3 推荐：**选项 B**

理由：

1. 不破坏现有配额经济模型（30/日的预算锚点已经在订阅定价里 priced-in）
2. 共享 synthesis 反而让 AI 输出**质量更高**——模型看到完整空间分布，可以做"近场 X 类，远郊 Y 类"的对照式 oneLiner
3. 60 POI 上限远低于 DeepSeek 上下文压力线；prompt 工程可控
4. 失败爆炸半径问题可通过"per-ring Overpass 缓存 + skeleton 兜底"对冲

**Phase 2 可演进到 B+**：4 环 Overpass 并行 → 1 次 synthesis 输出"分环结构化 JSON"，前端按环展示渐进进度条；不在本 PRD MVP 范围。

## 5. UI 状态机

### 5.1 进行中

- 按钮文案: "Exploring nearby…" → "Loaded R1 (1.5 km, 12 places)…" → 渐进推进
- 因为选项 B 是一次 synthesis：4 环 Overpass 并行加载阶段可以显示"Scanning area…"，进入 AI 阶段切到"Synthesizing 47 places…"
- 触觉反馈：每环 Overpass 完成 light haptic；synthesis 完成 success haptic

### 5.2 单环失败降级

- Overpass 某环 timeout/empty → 该环跳过，toast: "Outer ring unavailable, showing 32 places"
- 全部环失败 → 沿用现有 `lastExploreError` + offline 回退路径（`closestRecentRegion`）
- AI synthesis 失败 → 60 POI 全部走 skeleton，不写缓存（与现状一致）

### 5.3 去重提示

- 不在 UI 显式提示用户"去重了 N 个"（噪音）
- 仅在 `lastExploreToast` 用最终数字: "Now exploring Chiang Mai · 47 places added across 12 km"
- 文案 key: `explore.toast.multiRing.addedNamed`，参数: 城市名、总数、最大半径

## 6. 成功指标

| 指标                                 | 目标                | 测量方式                                     |
| ------------------------------------ | ------------------- | -------------------------------------------- |
| Pro DAU 中触发 Explore 的比例        | ≥ 现状 +20pp        | 客户端事件                                   |
| 单次 Explore 平均加载 Experience     | 现状 ~13 → **≥ 30** | `lastExploreAddedCount` 聚合                 |
| Pro 月留存（D30）                    | +5pp                | 订阅事件 vs 控制组（无多环）                 |
| 试用→订阅转化                        | +3pp                | 在 Paywall 之后第一次成功 Explore 的转化漏斗 |
| 单次 Explore Anthropic/DeepSeek 成本 | ≤ 现状 1.3x         | Edge Function 计费日志                       |
| Overpass 失败率（任一环）            | < 5%                | OverpassService 监控                         |

## 7. 风险

- **Overpass 速率限制**: 4 环并发对同一节点可能触发反爬。缓解：环间 150ms 抖动 + 复用 `regionKey` 缓存；fallback 到 Overpass mirror
- **AI 总 token 成本上扬**: 单次 prompt 60 POI ≈ 4x 当前 token；通过 prompt 压缩（去掉冗余 tags、坐标 4 位小数）控制在 2.5x 以内
- **地图渲染压力**: 一次性 +50 节点对 MapKit annotation 性能影响有限（已验证 200 节点流畅），但 BottomInfoBar 的"附近 solo 数量"需要重新计算 → 在 main actor batched 写一次
- **用户心智混乱**: 12 km 外的"附近"违反直觉。缓解：toast 明确写出半径; ExperienceDetail 里加上"~8 km from you"的距离提示
- **离线区域缓存膨胀**: `recordRecentExploreRegion` 每次 Explore 记 4 个 region。缓解：只记录最外环（12km），最大覆盖、最少记录

## 8. Stories（每个 ≤ 1d）

### US-MR-01 多环 schedule（M）

`MapViewModel.exploreNearby` 重构为：依次/并行调度 4 个 Overpass 查询；合并去重后 POI 列表传给 single synthesis；保留单环失败旁路。

DoD: 单元测试覆盖 "全成功 / R3 失败 / 全失败" 三条路径。

### US-MR-02 跨环去重（S）

POI 层按 osmId 去重；Experience 层 `appendGenerated` 已按 id 去重，确认无需改动。增加 `OverpassService.dedupe(across:)` 工具方法。

DoD: 一个生成的 fixture（R1∩R2 故意重叠 3 个）测试通过。

### US-MR-03 配额策略（S）

确认选项 B：把 `synthesisLimit` 从 15 提到 60；prompt 模板加 "POIs span 0–12 km from query center, group output by approximate distance band" 指令；Pro 配额保持 30/日。

DoD: prompt snapshot 测试；Edge Function 端同步更新。

### US-MR-04 UI 进度状态（M）

`MapViewModel` 新增 `exploreProgress: ExploreProgress?`（enum: `.scanning(ringsDone: Int)`, `.synthesizing(poiCount: Int)`, `.idle`）；CompassMapView 绑定到 BottomInfoBar 上方的 inline progress。Toast 文案新增 multiRing 变体。

DoD: SwiftUI Preview 三状态可见；视觉一致性 review 通过。

### US-MR-05 测试 + 指标（S）

XCTest: 多环 schedule 单元测试 + UI snapshot；analytics 事件 `explore_multi_ring_completed` 上报 `addedCount, maxRadius, failedRings, durationMs`。

DoD: CI 通过；事件在 dev console 可见。

## 9. Out of Scope

- 用户自选环数 / 自定义半径（产品复杂度收益不成正比，保持"一键探索"心智）
- 跨城市探索（>50km）——超出"附近"语义，应该是不同的 feature（"Plan a day trip"）
- 异步 / 后台预探索（"打开 app 时悄悄拉好 12 km 数据"）——电量风险，留待 Phase 3
- Free 用户多环（Free 仍单环 skeleton，差异化的核心）
- 自适应环数（"在 POI 密集城市少几环"）——先做固定 4 环，根据指标再调

## 10. 上线检查

- [ ] `pnpm parity:check` 通过（如果 Experience schema 不变则免）
- [ ] `xcodebuild test` 全绿，含 US-MR-01/02 新增用例
- [ ] DeepSeek Edge Function `synthesize-experiences` 同步上调 POI 上限
- [ ] Feature flag `proMultiRingExplore`（默认关），灰度 10% Pro 用户
- [ ] Analytics dashboard 已配置 `explore_multi_ring_completed`
- [ ] 文档：CHANGELOG + 应用内 What's New 卡片
