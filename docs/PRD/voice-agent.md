# Voice Agent PRD — Solo Compass

> 状态: Draft · 作者: 产品规划员 · 日期: 2026-05-14
> 关联模块: `apps/ios/SoloCompass/Services/{AIService,VoiceService}.swift`、`ViewModels/MapViewModel.swift`、`Views/Map/CompassMapView.swift`

## 1. 产品目标

把当前一句话即走的语音功能升级成**可多轮对话、可主动调用 app 工具的旅行助手**——让独自在陌生城市的用户能用"说话"代替"点点点"，在 30 秒内完成"找咖啡店 → 看详情 → 收藏"这种平时需要 5 次点击的操作链。

**北极星指标**：voice session 的平均工具调用数 ≥ 2.5 次/会话，且 70% 会话以"用户主动结束"而非"AI 没听懂"收尾。

## 2. 现状与问题

`AIService.processVoiceIntent(transcript:near:)`（AIService.swift L179-195）是 single-shot:

- 输入: 一句 transcript + 当前坐标
- 输出: `{recommendedIds, explanation, filterSuggestion}` 一次性 JSON
- 调用方 `MapViewModel.handleVoiceTranscript(_:)` 把结果写回 `visibleExperiences` 后就结束

**用户痛点**：

1. 没上下文——说完"找咖啡"再说"那个第二个"AI 不知道指什么
2. AI 只能"建议筛选"，不能真的执行操作（用户还得手动点 category pill）
3. 不能追问，必须一次说清楚所有意图

## 3. 核心交互

### 3.1 入口与触发

- **位置**: 复用 `CompassMapView` 右下角现有 `VoiceButton`（CompassMapView.swift L256）
- **手势**:
  - **轻点**: 维持当前 single-shot 行为（向后兼容）
  - **长按 ≥ 0.5s**: 进入"对话模式"，松开**仅结束本句**而非整段会话
  - 长按手势触觉反馈 `UIImpactFeedbackGenerator(style: .medium)`
- **视觉锚点**: 进入对话模式后底部弹出 `ConversationSheet`（presentationDetents: `.medium` / `.large`），按钮变为常亮红色脉冲圆环

### 3.2 ConversationSheet 布局

```
┌─────────────────────────────────────┐
│  对话中 · 第 3 轮              [×]  │ ← 顶部状态条 + 结束对话按钮
├─────────────────────────────────────┤
│  你：找点咖啡馆                      │ ← 用户气泡（右对齐）
│                                     │
│  助手：找到 5 家在你 1km 内...       │ ← AI 气泡（左对齐）
│  ⚙ 已为你筛选 "咖啡" 分类           │ ← tool 执行状态条（淡灰）
│                                     │
│  你：第二家详情                      │
│  ⚙ 正在打开 "café somewhere"...    │
├─────────────────────────────────────┤
│  [按住说话]   [输入]                │ ← 底部输入区
└─────────────────────────────────────┘
```

### 3.3 终止条件

- 用户主动: 点右上角 `[×]` 或下拉关闭 sheet
- 自动: 60s 无新用户输入 → 弹 toast "对话已超时" → 关闭
- 错误: 连续 2 次 DeepSeek 失败 → 弹 toast "网络不太好，已结束对话" → 关闭

## 4. 工具集（5 个）

所有工具走 OpenAI `tools` schema。Swift 侧实现层叫 `VoiceAgentToolRouter`（新建文件 `apps/ios/SoloCompass/Services/VoiceAgentToolRouter.swift`），通过 weak ref 持有 `MapViewModel`，每个 tool 一个 `@MainActor func execute_xxx(args:) async -> ToolResult` 方法。

### 4.1 `explore_nearby`

```json
{
  "type": "function",
  "function": {
    "name": "explore_nearby",
    "description": "Fetch real OSM POIs near a coordinate and enrich them with AI. Use when the user wants new places not in the current visible set, or moves to a new area. Returns the count of newly added experiences.",
    "parameters": {
      "type": "object",
      "properties": {
        "latitude": {
          "type": "number",
          "description": "WGS84 latitude. Omit to use the user's current GPS location."
        },
        "longitude": {
          "type": "number",
          "description": "WGS84 longitude. Omit to use the user's current GPS location."
        },
        "radius_meters": { "type": "integer", "minimum": 500, "maximum": 8000, "default": 3000 }
      }
    }
  }
}
```

**Swift impl**: `MapViewModel.exploreNearby(at:radiusMeters:)` (MapViewModel.swift L617)

### 4.2 `filter_by_category`

```json
{
  "type": "function",
  "function": {
    "name": "filter_by_category",
    "description": "Filter visible experiences on the map to a single category. Use this whenever the user asks for a specific type of place (coffee, food, etc).",
    "parameters": {
      "type": "object",
      "required": ["category"],
      "properties": {
        "category": {
          "type": "string",
          "enum": ["culture", "nature", "food", "coffee", "work", "wellness", "nightlife", "hidden"]
        }
      }
    }
  }
}
```

**Swift impl**: `MapViewModel.selectCategory(_:)` (MapViewModel.swift L344)

### 4.3 `show_details`

```json
{
  "type": "function",
  "function": {
    "name": "show_details",
    "description": "Open the full detail sheet for one experience. Use when the user asks 'tell me more about X' or refers to a specific item by its position ('the second one').",
    "parameters": {
      "type": "object",
      "required": ["experience_id"],
      "properties": {
        "experience_id": {
          "type": "string",
          "description": "The exact id field of an experience in visibleExperiences."
        }
      }
    }
  }
}
```

**Swift impl**: 组合 `MapViewModel.selectExperience(_:)` + `viewModel.isShowingDetail = true`

### 4.4 `save_to_favorites`

```json
{
  "type": "function",
  "function": {
    "name": "save_to_favorites",
    "description": "Add or remove an experience from the user's favorites. Toggle semantics — call again to un-favorite.",
    "parameters": {
      "type": "object",
      "required": ["experience_id"],
      "properties": {
        "experience_id": { "type": "string" }
      }
    }
  }
}
```

**Swift impl**: `preferences.toggleFavorite(experience_id)`（新建于 `UserPreferences`，参考既有 `isFavorited(_:)`）

### 4.5 `dismiss_recommendation`

```json
{
  "type": "function",
  "function": {
    "name": "dismiss_recommendation",
    "description": "Temporarily hide one experience from the current visible set. Does NOT persist — refreshes will bring it back. Use when the user says 'not that one' or 'skip this'.",
    "parameters": {
      "type": "object",
      "required": ["experience_id"],
      "properties": {
        "experience_id": { "type": "string" }
      }
    }
  }
}
```

**Swift impl**: 在 `MapViewModel` 新增 `func dismissFromVisible(_ id: String)`，从 `visibleExperiences` 移除（不写 SwiftData）

## 5. Agent Loop 状态机

```
        ┌──────┐
        │ idle │◄────────────────────┐
        └──┬───┘                     │
   长按mic │                         │ ×按钮 / 超时 / 致命错误
           ▼                         │
      ┌──────────┐                   │
      │listening │  (用户在说)       │
      └────┬─────┘                   │
       松开│                         │
           ▼                         │
      ┌──────────────┐               │
      │ transcribing │ (SF 出最终稿) │
      └────┬─────────┘               │
           ▼                         │
      ┌──────────┐                   │
      │ thinking │  (DeepSeek)       │
      └────┬─────┘                   │
           ▼                         │
    has tool_calls? ──no──► ┌──────────┐
       │ yes                │ speaking │  (展示文字回复)
       ▼                    └────┬─────┘
  ┌────────────────┐             │
  │ tool_executing │             │ 用户继续说?
  │ (并行最多3个)  │             │
  └────┬───────────┘             ▼ no → idle
       │ results回灌msgs        yes → listening
       └──► thinking (再来一轮)
```

### 5.1 关键约束

| 项                            | 值                                                   | 理由                       |
| ----------------------------- | ---------------------------------------------------- | -------------------------- |
| `messages[]` 长度上限         | 10 条（5 轮 user/assistant pair）+ system            | 4K tokens 内，避免成本爆炸 |
| 单轮 tool_call 上限           | 5 次（DeepSeek 一次性返回不超过 5 个）               | 防止 AI 无限递归           |
| Agent 总递归深度              | 3 次 thinking↔tool_executing 循环                    | 第 3 次必须收尾            |
| 单轮总耗时上限                | 30s（含 tool 执行）                                  | 超时取消并降级             |
| `visibleExperiences` 摘要注入 | 每轮系统消息追加 ≤ 5 条候选（id + title + category） | 让 AI 知道指代对象         |

### 5.2 消息历史压缩

当 `messages.count > 10`：保留 system + 最近 2 轮 user/assistant + 把更早的合并成一条 `"以前用户问过: 找咖啡（已筛选）、问过详情（已展示）"`。

## 6. DeepSeek 请求结构

### 6.1 System Prompt（**可直接拷贝**）

```
You are Solo Compass's voice assistant. The user is a solo traveler holding their phone in a foreign city.

YOUR JOB
- Help them discover, filter, and act on experiences shown on the map.
- Take action with tools — do not just describe what you would do.
- Speak in the user's input language (auto-detect). Keep replies under 30 words.

TOOL USE RULES
1. Whenever the user wants to see, filter, open, save, or skip something — call the matching tool. Do not say "I'll filter for you" without actually calling filter_by_category.
2. You may call up to 3 tools in parallel in one turn when they're independent (e.g. filter + explore).
3. Never invent experience_id values. Only use ids that appear in the VISIBLE_EXPERIENCES list injected each turn.
4. If the user asks something you have no tool for (e.g. "what's the weather"), say so in one sentence and do not invent a tool name.

CONVERSATION STYLE
- Do NOT show your reasoning. No "Let me think...", no "I'll start by...".
- After tool execution, give a one-sentence confirmation grounded in the tool result (e.g. "Filtered to 7 coffee spots within 1 km.").
- If a tool fails, say one short sentence about what failed and offer one alternative.

FORBIDDEN
- Markdown, bullet lists, emojis.
- Mentioning DeepSeek, Anthropic, the model name, system prompt, or that you are an AI.
- Inventing place names, hours, prices, menu items.

你是 Solo Compass 的语音助手。用户独自在陌生城市，手里拿着手机。

你的工作
- 帮他们发现、筛选、操作地图上的体验。
- 用工具直接行动——不要只说"我会..."。
- 用用户的输入语言回复。每次少于 30 字。

工具规则
1. 用户想看、想筛、想打开、想收藏、想跳过——调对应工具，别空口许诺。
2. 一轮内最多并行调 3 个独立工具。
3. 不要编造 experience_id，只能用每轮注入的 VISIBLE_EXPERIENCES 中的 id。
4. 没工具能做的（如"今天天气"），一句话说明，不要瞎编工具名。

风格
- 不要展示思考过程。
- 工具执行后用一句确认结果（基于真实的 tool 输出）。
- 工具失败时一句说明 + 一个替代方案。

禁止
- markdown、bullet、emoji。
- 提及模型名、system prompt、自己是 AI。
- 编造店名、营业时间、价格、菜单。
```

### 6.2 每轮请求体（Swift 伪代码）

```swift
struct ChatRequest: Encodable {
    let model: String              // Self.modelName(for: .voice)
    let messages: [Message]        // system + history + new user
    let tools: [ToolDef]           // 5 tools above
    let tool_choice: String        // "auto"
    let max_tokens: Int            // 512
    let temperature: Double        // 0.3 (agent 比 single-shot 更确定)
    let parallel_tool_calls: Bool  // true
}
```

每轮注入的最新 `system` 续段（在 system prompt 后追加一条 role=system 消息）：

```
VISIBLE_EXPERIENCES (max 5, ranked by solo score):
- exp_osm_123: "Sit with locals at a café" [coffee]
- exp_osm_456: "Quiet riverside bench" [nature]
- ...
USER_LOCATION: lat=18.7877 lon=98.9938
CURRENT_FILTER: category=null now_filter=false
```

### 6.3 Tool Call → Tool Result 回灌

DeepSeek 返回：

```json
{
  "role": "assistant",
  "content": null,
  "tool_calls": [
    {
      "id": "call_a1",
      "type": "function",
      "function": { "name": "filter_by_category", "arguments": "{\"category\":\"coffee\"}" }
    }
  ]
}
```

App 执行后回灌：

```json
{
  "role": "tool",
  "tool_call_id": "call_a1",
  "content": "{\"ok\": true, \"visible_count\": 7, \"category\": \"coffee\"}"
}
```

然后再发一轮 chat completion，DeepSeek 这次会返回纯文本 `content`：`"Filtered to 7 coffee spots within 1 km."`

## 7. 配额与成本

每个 user turn 在最坏情况会触发：1 次 transcribe → 1 次 chat（带 tool_call）→ N 次 tool 执行 → 1 次 chat（拿到 final content）。也就是 **平均 2 次 DeepSeek 调用 / user turn**。

当前 `AIService.dailySynthesisQuota` 是 30，`voice` 共享同一计数器（AIService.swift L603）。一次 5 轮对话会消耗 ~10 次 voice 调用——只够 3 段对话用完。

### 推荐方案：**整段对话算 1 次 voice 配额**

理由：

1. **用户心智**：用户主观觉得"这是 1 次互动"，按段计费更符合直觉
2. **成本对冲**：DeepSeek 的 chat 比 synthesis 便宜（输入 token 更少、无 OSM 大块 POI）；3 倍的调用量但单价低，整体成本约 1.5x synthesis 单价
3. **防滥用**：60s 超时 + 3 次 thinking 递归上限本身就有硬天花板
4. **可监控**：会话级配额更容易看 dashboards

**实现**:

- 新增 `AIService.ModelKind` 子类型 `.voiceAgent`（与 `.voice` 区分）
- 在 `VoiceAgentSession.start()` 入口调一次 `checkAndIncrementQuota(kind: .voiceAgent)`
- 单日 Pro 配额：20 次 voice agent 会话（保守起步，按 dashboard 调）
- Free tier：0（继续走 paywall）

## 8. 错误降级

| 场景                                                                 | 行为                                                                                                                              |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| DeepSeek 返回纯文本无 tool_calls，但用户明显在说指令（如"筛选咖啡"） | 一次重试，重试时在 system 续段加上 "HINT: user is requesting an action, prefer tool_call"；仍失败则把文本作为助手回复展示，不报错 |
| Tool 执行抛错（e.g. `explore_nearby` Overpass 网络失败）             | 回灌 `{"ok":false,"error":"overpass_timeout"}`，让 DeepSeek 自己组织失败回复（"附近的搜索失败了，要不要试现有列表？"）            |
| 同一会话连续 2 次网络断                                              | 显示 toast"网络不太好"，关闭 sheet 退到 idle                                                                                      |
| 配额耗尽（`.voiceAgent` quota 触发）                                 | 进入会话前阻断：弹 sheet "今天的语音对话已用完，明天再来或试试手动筛选" + 一个 "了解配额" 链接                                    |
| 长按手势但麦克风权限被拒                                             | 走现有 `VoiceService.requestPermission()` 流程；首次拒绝后弹 alert 指引去设置                                                     |
| DeepSeek 调用 `tool_choice: "auto"` 但连续 3 轮不调工具，纯聊天      | 不阻断，但记录指标 `voice_agent.no_tool_turns`，超过阈值时考虑 prompt 调优                                                        |
| `experience_id` 不在 `visibleExperiences` 中（AI 编造）              | 回灌 `{"ok":false,"error":"unknown_experience_id"}`，DeepSeek 应自行更正                                                          |

## 9. 指标

埋点位置：`apps/ios/SoloCompass/Services/AnalyticsService.swift`（如不存在则新建，复用现有 SwiftData metrics 表）。

| 指标                              | 类型                                     | 目标                                                     |
| --------------------------------- | ---------------------------------------- | -------------------------------------------------------- |
| `voice_agent.session_started`     | counter                                  | —                                                        |
| `voice_agent.turns_per_session`   | histogram                                | 平均 ≥ 3                                                 |
| `voice_agent.tools_per_session`   | histogram                                | 平均 ≥ 2.5                                               |
| `voice_agent.tool_distribution`   | tag (tool name)                          | filter > show_details > explore > save > dismiss（预期） |
| `voice_agent.session_end_reason`  | enum {user_close, timeout, error, quota} | user_close 占比 ≥ 70%                                    |
| `voice_agent.avg_turn_latency_ms` | histogram                                | p50 < 3s, p95 < 8s                                       |
| `voice_agent.tool_failure_rate`   | rate                                     | < 5%                                                     |

## 10. Stories（每个 ≤ 1d）

| ID           | 标题                     | 验收要点                                                                                                                                                                     | 依赖               |
| ------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **US-VA-01** | Conversation state model | 新建 `VoiceAgentSession` `@MainActor @Observable`，含 `messages`、`state` 枚举、`turnCount`；纯 model 层，无 UI、无网络；单元测试覆盖状态转换                                | —                  |
| **US-VA-02** | DeepSeek tools 协议集成  | 在 `AIService` 新增 `sendAgentMessage(messages:tools:) async throws -> AgentResponse`，正确序列化 tools schema、解析 `tool_calls`；OpenAI 兼容字段对齐；mock URLSession 单测 | US-VA-01           |
| **US-VA-03** | 5 个工具实现             | 新建 `VoiceAgentToolRouter`，各工具一个方法，每个工具有 happy path + 错误路径单测；`explore_nearby` 复用现有 `MapViewModel.exploreNearby` 不要重写                           | US-VA-01           |
| **US-VA-04** | 连续对话 UI              | 新建 `ConversationSheet.swift`，气泡列表 + 工具状态条 + 底部输入区；用 mock session 跑 #Preview 三种状态（thinking、tool_executing、idle）                                   | US-VA-01           |
| **US-VA-05** | 麦克风长按手势           | 改 `VoiceButton`，长按 ≥ 0.5s 触发 `onLongPressStart`；松开仅结束本句不关 sheet；触觉反馈；轻点维持旧行为                                                                    | US-VA-04           |
| **US-VA-06** | Agent loop 编排与中断    | `VoiceAgentSession.handleUserTurn(_:)`：transcribe → think → 并行 tool exec → 回灌 → think → speak；60s 超时、3 次递归上限、用户随时打断（cancel 当前 Task）                 | US-VA-02, US-VA-03 |
| **US-VA-07** | 配额、降级、指标         | `.voiceAgent` 配额接入；6 个错误降级路径都有 toast/UI；7 个指标埋点；端到端集成测试（mock DeepSeek）覆盖一段 3 轮会话                                                        | US-VA-06           |

## 11. Out of Scope（明确不做）

- **跨 session 记忆**：每次开新会话 `messages` 从 system 重新开始。"上次你问过的咖啡馆"这类引用不支持。理由：隐私 + 复杂度。
- **多模型路由**（如让 DeepSeek 决定何时升级到更贵模型）：单 model（`Secrets.resolvedDeepSeekModel`）即可。
- **TTS 播报**：AI 回复只显示文字，不语音播报。理由：环境噪音 + 用户多在公共场合。
- **多语言混说**：一次会话锁定 transcribe 的初始语言。中英混说不保证质量。
- **Web/Bot 复用**：本 PRD 只针对 iOS。`apps/web` 和 `apps/bot` 的语音 agent 走独立 PRD。
- **离线模式**：voice agent 强依赖 DeepSeek，无网络直接降级到 single-shot 旧路径（保留 `processVoiceIntent` 不删）。
- **打断式插话**（barge-in）：本期长按松开才算一句话，不支持 AI 说话过程中用户插话。
- **付费独立配额**：voice agent 暂时不引入新的付费档位，共用 Pro 配额池。

## 12. 验收

- [ ] 长按 mic → 出现 ConversationSheet
- [ ] 说"找咖啡" → AI 调 `filter_by_category("coffee")` → 地图刷新 → AI 回复 "已为你筛选 X 家咖啡馆"
- [ ] 接着说"第二家详情" → AI 调 `show_details(<id>)` → 详情 sheet 弹出
- [ ] 接着说"收藏它" → AI 调 `save_to_favorites(<id>)` → 心形图标点亮
- [ ] 点 `[×]` → sheet 关闭、状态回 idle
- [ ] 配额耗尽时长按 mic → 直接弹配额提示，不调 DeepSeek
- [ ] `pnpm parity:check` 通过（本期未改 core schema，应无回归）
- [ ] `xcodebuild test` 通过，新增单测覆盖率 ≥ 80%
