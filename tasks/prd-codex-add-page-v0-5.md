# PRD: Codex `/add` 页面体验优化 v0.5

> **来源**：基于 2026-05-20 `/add` 页面测试报告（CODEX v0.4 · PRIVATE）整理。
> **范围**：仅覆盖 Web 端 `/add` 路由及其紧邻的最小详情页 `/memos/[id]`。
> **不绑定**：本 PRD 描述的是 Codex（Next.js Web）应用，与本仓库 Solo Compass iOS 项目独立。

---

## 1. Introduction / Overview

`/add` 是 Codex「Add to the wiki」的内容投递入口，由三段组成：

- **输入区** — `textarea` + 多模式按钮（URL / Photo / File / Voice / Bookmarklet）+ `Save draft` / `Add`
- **Compile Queue** — 待编译队列（pending）
- **Recently Compiled** — 最近完成（done）

测试报告 v0.4 验证了核心提交链路（输入 → `POST /api/memos` → SSE 编译 → 完成）稳定可用，但在**辅助交互**层面存在 9 个明确缺陷与多个模式按钮行为空缺。本 PRD 的目标是把 `/add` 从「能用」推到「生产级可用」：草稿不丢失、快捷键可用、状态瞬时一致、所有模式按钮行为明确、列队卡片可点击进入详情。

### 解决的问题

| 类别       | 现状痛点                                                |
| ---------- | ------------------------------------------------------- |
| 内容损失   | Save draft 后刷新即丢失，用户输入有损耗风险             |
| 输入效率   | `⌘+Enter` 不工作，与 Web 通用心智模型不符               |
| 状态一致性 | 面包屑 / `QUEUED` 文案需刷新才正确，明显 SSR/CSR 不同步 |
| 模式空缺   | Photo / File / Bookmarklet 按钮行为不明或异常           |
| 导航缺失   | 队列卡片无法点入详情，闭环不完整                        |

---

## 2. Goals

- **G1** 零数据损失：草稿在本地 + 服务端双写，跨刷新、跨设备可恢复。
- **G2** 一次提交无障碍：`⌘+Enter` / `Ctrl+Enter` 在 textarea 内即提交。
- **G3** 首帧状态一致：面包屑、`QUEUED` 状态在首屏即正确，无需刷新。
- **G4** 模式按钮完全可用：URL / Photo / File / Voice / Bookmarklet 每个都有明确、可验证的行为。
- **G5** 队列闭环：点击队列 / Recently Compiled 卡片可进入 memo 详情页。
- **G6** 性能稳定：模式按钮点击在 P95 ≤ 200ms 内有视觉反馈，无 30s 渲染卡顿复现。
- **G7** 不引入新的客户端控制台 Error / Warning。

---

## 3. User Stories

> 每个 Story 控制在「一次专注会话可完成」的粒度。涉及 UI 的 Story 均要求用 `dev-browser` skill 在浏览器中实测验证。

### US-001：草稿本地持久化（修 BUG-01）

**Description**：作为用户，我希望即使刷新或关闭浏览器，已经 Save draft 的内容也能在我回到 `/add` 时自动回填，从而避免内容丢失。

**Acceptance Criteria**

- [ ] 点击 `Save draft`：写入 `localStorage` 的 `codex:add:draft` 键（包含 `content`、`type`、`attachments_meta`、`savedAt`）
- [ ] 页面挂载时：若 localStorage 中存在草稿且 `savedAt` 在 30 天内，回填到 textarea 并显示「Draft restored」提示（带「Discard」按钮）
- [ ] 提交成功（`POST /api/memos` 201）后：清除该 localStorage 键
- [ ] 「Draft restored」提示在用户开始编辑或 5 秒后自动隐藏
- [ ] 类型与附件元信息也一并恢复（如曾选过 URL 模式或附件占位）
- [ ] Typecheck / lint 通过
- [ ] 用 dev-browser skill 验证：输入文本 → Save draft → 刷新 → 文本回填

---

### US-002：草稿后端同步（跨设备）

**Description**：作为多设备用户，我希望草稿在登录的同一账号下跨浏览器/设备可见，避免换设备时丢失编辑进度。

**Acceptance Criteria**

- [ ] 新增 `GET /api/drafts/add` 返回当前用户最新草稿（最多 1 条），`200` 含 `{ content, type, updatedAt }`，无则返回 `204`
- [ ] 新增 `PUT /api/drafts/add` 接收 `{ content, type }`，幂等更新，返回 `200`
- [ ] 新增 `DELETE /api/drafts/add` 删除，返回 `204`
- [ ] 客户端：本地 Save draft 后，**防抖 1.5s** 后异步 `PUT`，失败静默重试 ≤ 2 次（不打断用户）
- [ ] 客户端：页面挂载时优先读本地草稿；若本地为空再 `GET` 服务端草稿
- [ ] 冲突策略：本地与服务端均存在时，取 `updatedAt` 较新者
- [ ] 鉴权失败（401）时降级为纯本地草稿，不报错
- [ ] Typecheck / 单测覆盖 drafts 路由
- [ ] 用 dev-browser skill 验证：A 浏览器存草稿 → B 浏览器登录同账号打开 `/add` → 草稿回填

---

### US-003：`⌘+Enter` / `Ctrl+Enter` 快捷键提交（修 BUG-02）

**Description**：作为重度键盘用户，我希望在 textarea 内按 `⌘+Enter`（mac）或 `Ctrl+Enter`（Win/Linux）触发 Add 提交。

**Acceptance Criteria**

- [ ] textarea 监听 `keydown`：`(metaKey || ctrlKey) && key === 'Enter'` 触发与点击 Add 一致的提交流程
- [ ] Add 按钮处于禁用态时（空内容）快捷键无效
- [ ] 提交进行中再次按下不重复提交（受 Add 按钮 disabled 态保护）
- [ ] placeholder 下方 hint 文案新增：`⌘/Ctrl + Enter to submit`
- [ ] 输入法（IME）合成期（`isComposing === true`）忽略快捷键，避免中文输入误触
- [ ] Typecheck 通过
- [ ] 用 dev-browser skill 验证：输入文本 → 按 ⌘+Enter → 队列出现新条目，textarea 清空

---

### US-004：面包屑首帧一致（修 BUG-04）

**Description**：作为从其他页面跳转到 `/add` 的用户，我希望顶部面包屑首帧即显示 `CODEX / Add`，而不是 `CODEX / Home`。

**Acceptance Criteria**

- [ ] 面包屑组件改为基于 `usePathname()` 的客户端派生，或在 server component 中按当前路由解析
- [ ] 由 `/home`、`/wiki`、`/chat` 等任意页跳转到 `/add`，首帧（≤ 1 帧）面包屑即正确
- [ ] 直接访问 `/add`、`/add?from=xxx` 等场景同样首帧正确
- [ ] 不引入 layout shift
- [ ] Typecheck 通过
- [ ] 用 dev-browser skill 验证：依次从 Home → Add、Wiki → Add 跳转，截图比对面包屑

---

### US-005：新条目即时显示 `QUEUED`（修 BUG-05）

**Description**：作为用户，我希望刚提交的新条目在 Compile Queue 中立即显示 `QUEUED`，而不是要等刷新才出现。

**Acceptance Criteria**

- [ ] `POST /api/memos` 201 响应里包含完整 memo 对象（含 `compile_status: 'queued'`、`created_at`）
- [ ] 客户端用响应体乐观更新 Compile Queue 列表，**不再依赖** 二次 `GET /api/memos?compile_status=pending`
- [ ] 列表项渲染：若 `compile_status === 'queued'` 显示 `QUEUED`；若为 `compiling` 显示 `COMPILING`；done 移入 Recently Compiled
- [ ] SSE `/api/stream/compile` 推送状态变更时，本地列表项就地更新（按 `id` 匹配）
- [ ] 失败重试：若 POST 返回 4xx/5xx，撤回乐观更新并 toast 报错
- [ ] Typecheck 通过
- [ ] 用 dev-browser skill 验证：连续提交 3 条 → 顶部 3 条立即都带 `QUEUED` 标签

---

### US-006：队列卡片点击进入 memo 详情页（修 BUG-03）

**Description**：作为用户，我希望点击 Compile Queue 或 Recently Compiled 中卡片主体区域，跳转到该 memo 的详情页查看完整内容与编译结果。

**Acceptance Criteria**

- [ ] 卡片主体（除右侧 LIGHT/FULL 切换标签及 ✕ 按钮以外的区域）为可点击区域
- [ ] 点击导航至 `/memos/[id]`，使用 `next/link` 而非 `router.push`（保证可中键打开新标签）
- [ ] 右侧 LIGHT/FULL 标签 `stopPropagation`，不触发跳转
- [ ] 卡片获得 `role="link"` + 键盘可达（`Enter` / `Space` 触发同等跳转）
- [ ] hover/focus 视觉反馈与原有一致
- [ ] Typecheck 通过
- [ ] 用 dev-browser skill 验证：点击卡片中部 → URL 变为 `/memos/<id>`；中键点击在新标签打开

---

### US-007：最小 memo 详情页 `/memos/[id]`（支撑 US-006）

**Description**：作为用户，我希望进入详情页能看到这条 memo 的原文、类型、当前状态、编译结果（如已完成），并能从详情页返回 `/add`。

**Acceptance Criteria**

- [ ] 新增路由 `/memos/[id]`（Server Component + 客户端 SSE 订阅状态）
- [ ] 服务端 `GET /api/memos/[id]` 返回 `{ id, type, content, compile_status, compiled_at, compiled_payload, created_at }`，不存在返回 `404`
- [ ] 页面渲染：原文（保留换行、安全转义）、类型徽章、`QUEUED / COMPILING / DONE / FAILED` 状态、若 done 则展示 `compiled_payload`
- [ ] 顶部面包屑 `CODEX / Add / Memo`，左侧返回按钮回到 `/add`
- [ ] 状态非终态时订阅 `/api/stream/compile?id=<id>`，状态变化就地刷新
- [ ] `compile_status === 'failed'` 时显示错误信息 + 「Retry」按钮调用 `POST /api/memos/[id]/recompile`
- [ ] 404 / 500 有友好兜底页
- [ ] Typecheck 通过，新增组件有 unit test
- [ ] 用 dev-browser skill 验证：从 `/add` 卡片进入 → 看到原文与状态 → 等待 SSE → 状态变为 DONE

---

### US-008：URL 模式行为明确化（修 BUG-07）

**Description**：作为用户，点击 URL 按钮时我希望切换为「URL 输入模式」（带链接预览/校验），而不是把当前页地址直接写入 textarea。

**Acceptance Criteria**

- [ ] 点击 URL 按钮：切换 `mode = 'url'`，按钮高亮，textarea placeholder 变为 `Paste a URL (https://...)`
- [ ] textarea 内容**保持不变**，**不再**自动填入 `window.location.href`
- [ ] 输入内容实时校验：非合法 URL 时 Add 按钮置灰并显示 `Enter a valid URL`
- [ ] 合法 URL 时下方显示 host 预览：`example.com`
- [ ] 再次点击 URL 按钮或选择其他模式：切换回原模式，textarea 内容保留
- [ ] 提交后 `POST /api/memos` body `{ type: 'url', content: <url> }`
- [ ] Typecheck 通过
- [ ] 用 dev-browser skill 验证：点 URL → 输入合法 URL → 提交，类型为 URL

---

### US-009：Photo 模式落地

**Description**：作为用户，点击 Photo 按钮时我希望弹出相册/相机选择器，选中后作为附件预览并随提交一起发送。

**Acceptance Criteria**

- [ ] 点击 Photo：触发隐藏 `<input type="file" accept="image/*" capture="environment">` 的 click
- [ ] 选中文件后在 textarea 上方显示缩略图 + 文件名 + 大小 + ✕ 移除按钮
- [ ] 单次最多 4 张图，超过提示 `Up to 4 photos per memo`
- [ ] 单张 ≤ 10MB，超出提示 `Image too large (max 10MB)`
- [ ] 提交：multipart `POST /api/memos`，body 含 `type: 'photo'`、`files[]`
- [ ] 服务端处理见 US-012
- [ ] 移除附件后 Photo 模式高亮取消（若无其他附件）
- [ ] Typecheck 通过
- [ ] 用 dev-browser skill 验证：上传一张图片 → 队列卡片显示 PHOTO 类型 + 缩略图

---

### US-010：File 模式落地

**Description**：作为用户，点击 File 按钮时我希望弹出系统文件选择器，附件随提交发送。

**Acceptance Criteria**

- [ ] 点击 File：触发隐藏 `<input type="file" accept=".pdf,.md,.txt,.docx,.rtf">` 的 click
- [ ] MIME 白名单：pdf / markdown / plain text / docx / rtf
- [ ] 单次 1 个文件，单文件 ≤ 25MB,超出提示具体错误
- [ ] 附件预览:文件图标 + 文件名 + 大小 + ✕ 移除
- [ ] 拖拽到 textarea 区域也走同一通道(drag-and-drop 支持)
- [ ] 提交:multipart `POST /api/memos`,body 含 `type: 'file'`
- [ ] Typecheck 通过
- [ ] 用 dev-browser skill 验证:上传 pdf → 队列卡片显示 FILE 类型

---

### US-011：Bookmarklet 模式正确行为（修 BUG-06）

**Description**：作为用户，点击 Bookmarklet 按钮我希望看到「拖到书签栏」的脚本与说明，而不是被自动附加一个无关图片。

**Acceptance Criteria**

- [ ] 点击 Bookmarklet：弹出 Modal，内含
  - 一个可拖入书签栏的 `<a href="javascript:...">Save to Codex</a>` 链接
  - 一段说明：在任意页面点击该书签可一键收藏到 Codex
  - 「Copy script」按钮复制 bookmarklet 源码
  - 「Close」按钮关闭
- [ ] 关闭 Modal 后 textarea 内容、模式、附件状态均保持不变
- [ ] **不再**自动附加 `IMG_3836.PNG` 或任何占位文件
- [ ] Bookmarklet 源码包含选中文本 / 当前 URL / 当前 title，POST 到 `/api/memos` 时附带 `source: 'bookmarklet'`
- [ ] Typecheck 通过
- [ ] 用 dev-browser skill 验证：点击 Bookmarklet → Modal 出现 → 关闭后 textarea 无脏数据

---

### US-012：附件上传与编译流水线对接（支撑 US-009 / US-010）

**Description**：作为后端，我需要接收附件、安全存储、并把附件信息纳入 memo 的编译队列。

**Acceptance Criteria**

- [ ] `POST /api/memos` 支持 `multipart/form-data`，向后兼容 `application/json`
- [ ] 服务端校验：MIME 白名单（image/jpeg|png|webp、application/pdf 等）、大小上限（图片 10MB，文件 25MB）
- [ ] 文件存储到对象存储（已有方案），memo 表存 `attachments` 字段（数组：`{ url, mime, size, original_name }`）
- [ ] `compile_status` 流程同既有：`queued → compiling → done | failed`
- [ ] 编译失败时 `attachments` 不丢失，前端详情页可显示「Compilation failed」并保留附件
- [ ] 新增 API 测试覆盖正常 / 超大 / 错误 MIME / 鉴权失败
- [ ] Typecheck 通过

---

### US-013：Voice 模式状态明确

**Description**：作为用户，Voice 按钮当前为 `coming soon`，我希望它有清晰的视觉禁用态与 tooltip，而不是只能从 aria-label 中推断。

**Acceptance Criteria**

- [ ] Voice 按钮渲染为 `disabled` 态（降低不透明度 / 鼠标禁用光标）
- [ ] hover / focus 显示 tooltip：`Voice input — coming soon`
- [ ] 键盘 focus 时同样可读出 tooltip（用 `aria-describedby`）
- [ ] 点击无任何副作用、无 toast、无错误
- [ ] Typecheck 通过
- [ ] 用 dev-browser skill 验证：hover Voice → tooltip 出现；点击无副作用

---

### US-014：模式按钮点击渲染稳定性（修 BUG-09）

**Description**：作为用户，我希望模式按钮在快速点击、自动化点击下都能稳定在 200ms 内有视觉反馈，不出现 30s 渲染卡顿。

**Acceptance Criteria**

- [ ] 模式按钮 onClick 内不做同步阻塞操作（文件选择器/Modal 等异步打开）
- [ ] 按钮高亮状态通过 React state 切换，避免大组件 re-render（局部 `useState` + memo）
- [ ] 加 Playwright/E2E 压测脚本：100 次随机点击在 30s 内全部完成且无超时
- [ ] React DevTools Profiler：单次模式切换 commit ≤ 16ms（一帧）
- [ ] Typecheck 通过

---

### US-015：键盘提示与可达性

**Description**：作为键盘用户与无障碍用户，我希望 `/add` 页面所有交互均可达且有适当反馈。

**Acceptance Criteria**

- [ ] 输入区底部新增 hint：`⌘/Ctrl + Enter to submit · Drag & drop files supported`
- [ ] 所有模式按钮均可 Tab 到达，焦点环明显
- [ ] 附件 ✕ 移除按钮 `aria-label="Remove attachment"`
- [ ] Compile Queue 卡片可用键盘 focus + Enter 触发跳转（来自 US-006）
- [ ] axe-core 扫描 `/add` 路由零 violation（critical / serious 级别）
- [ ] Typecheck 通过

---

## 4. Functional Requirements

> 编号便于代码 / 提交信息引用：`FR-X`。

### 草稿系统

- **FR-1** 客户端在 `Save draft` 时写入 `localStorage` 键 `codex:add:draft`。
- **FR-2** 服务端提供 `GET / PUT / DELETE /api/drafts/add`，支持单用户单草稿。
- **FR-3** 客户端在 `Save draft` 后防抖 1.5s 调用 `PUT /api/drafts/add`，失败重试 ≤ 2 次。
- **FR-4** 页面挂载读取顺序：本地 → 服务端（仅当本地空）；合并时取 `updatedAt` 较新者。
- **FR-5** 成功 `POST /api/memos` 后清除本地与服务端草稿。

### 提交链路

- **FR-6** textarea 监听 `(meta|ctrl) + Enter` 触发 Add；IME 合成期忽略。
- **FR-7** `POST /api/memos` 201 响应必须包含完整 memo 对象。
- **FR-8** 客户端用 201 响应体乐观更新 Compile Queue，失败回滚 + toast。
- **FR-9** SSE `/api/stream/compile` 推送的 `{ id, status, payload? }` 按 id 匹配并就地更新。

### 状态一致性

- **FR-10** 面包屑基于 `usePathname()` 渲染，路由切换首帧正确。
- **FR-11** 队列项渲染：`compile_status === 'queued' | 'compiling' | 'done' | 'failed'` 一一对应可见徽章。

### 模式系统

- **FR-12** 模式枚举：`'text' | 'url' | 'photo' | 'file' | 'voice' | 'bookmarklet'`。
- **FR-13** URL 模式：textarea 内容保持不变，校验为合法 URL 后才可提交。
- **FR-14** Photo 模式：触发 `<input type="file" accept="image/*">`，最多 4 张，单张 ≤ 10MB。
- **FR-15** File 模式：MIME 白名单 [pdf, md, txt, docx, rtf]，单文件 ≤ 25MB。
- **FR-16** Bookmarklet 模式：弹 Modal 展示脚本，不修改输入区状态。
- **FR-17** Voice 模式：保持 disabled 视觉态 + tooltip，无任何 onClick 副作用。
- **FR-18** 拖拽文件到 `/add` 整页区域：按 MIME 分流到 Photo / File 模式并附为附件。

### 详情页

- **FR-19** 新增路由 `/memos/[id]`、API `GET /api/memos/[id]`、`POST /api/memos/[id]/recompile`。
- **FR-20** 队列卡片主体使用 `next/link` 指向 `/memos/[id]`；右侧 LIGHT/FULL 切换 `stopPropagation`。

### 附件后端

- **FR-21** `POST /api/memos` 支持 `multipart/form-data`，文件落对象存储，元数据写入 memo 表 `attachments` 字段。
- **FR-22** 编译失败保留 `attachments`；详情页可重试编译。

### 性能与可达性

- **FR-23** 模式切换单次 React commit ≤ 16ms。
- **FR-24** axe-core 扫描 `/add` 与 `/memos/[id]` 路由：0 critical / serious violations。

---

## 5. Non-Goals (Out of Scope)

- 草稿多版本历史 / 自动恢复列表（本期只保留最新一份）
- 富文本编辑器（仍是纯 textarea + 附件）
- Voice 模式的真实录音 / 转写功能（保留 disabled 态，下一版交付）
- Bookmarklet 脚本的服务端跨域代理 / 自动 OG 抓取
- 队列卡片内联展开 memo 详情（统一改为跳详情页）
- 移动端响应式布局优化（本期仅保证 1280+ 桌面端体验）
- 多用户协作 / 共享草稿
- 国际化（沿用既有英文）

---

## 6. Design Considerations

- **面包屑** — 保持「CODEX / 当前页」二级结构；详情页为「CODEX / Add / Memo」三级。
- **附件预览** — 输入区上方 chip：图片缩略图 64×64，文件用 SVG 图标，统一 ✕ 移除按钮位置。
- **状态徽章配色** — `QUEUED`（灰）/ `COMPILING`（黄，带 spinner）/ `DONE`（绿）/ `FAILED`（红）；与现有 LIGHT/FULL 标签视觉区分。
- **Bookmarklet Modal** — 复用现有 `New domain` 对话框组件骨架（标题 + 内容 + Cancel/Action）。
- **Hint 文案** — 输入区底部 `⌘/Ctrl + Enter to submit · Drag & drop files supported`，使用 muted 颜色。
- **Draft Restored 提示** — 顶部 banner 形式，含「Discard」与「Keep」操作；5 秒或用户编辑后自动消失。

---

## 7. Technical Considerations

- **存储**：草稿键 `codex:add:draft`；版本前缀 `v1:`，便于后续 schema 演进时迁移。
- **API 形态**：草稿接口走既有 auth 中间件；未登录用户仅享受本地草稿，不触发后端调用。
- **SSE**：保持现有 `/api/stream/compile` 协议，新增 `?id=<memoId>` 单条订阅参数；不传则订阅本用户全量。
- **路由**：`/memos/[id]` 为 Server Component，初始 HTML 含 memo 主体，客户端订阅 SSE 增量更新。
- **可观测性**：所有新增按钮 onClick、API 调用记录到既有事件埋点系统（`add.draft.save` / `add.submit` / `add.mode.switch` / `memo.detail.view`）。
- **错误处理**：所有 fetch 失败统一通过 toast 暴露，详情页 4xx/5xx 走 Next.js error.tsx。
- **测试**：API 层用既有 vitest 套件；端到端用 Playwright 跑 `/add` 与 `/memos/[id]` 主流程；axe-core 接入 CI。
- **回归保护**：本 PRD 不修改已通过的 1.x / 2.x / 7.x / 8.x / 9.2 / 9.3 用例对应行为，CI 中保留这些用例。

---

## 8. Success Metrics

| 指标                                       | 当前 | 目标                            |
| ------------------------------------------ | ---- | ------------------------------- |
| 草稿恢复率（Save draft 后回访 24h 内回填） | 0%   | ≥ 95%                           |
| `⌘+Enter` 提交占总提交比                   | 0%   | ≥ 25%（推出后 14 天）           |
| 首帧面包屑正确率                           | 部分 | 100%                            |
| 新条目「QUEUED」首帧出现率                 | 0%   | 100%                            |
| 队列卡片点击进详情转化率                   | N/A  | ≥ 20%（提交后 7 天内回看 memo） |
| 模式按钮点击异常率（30s 超时 / 多余附件）  | 偶发 | 0                               |
| `/add` 路由控制台 Error / Warning          | 0    | 0（不退化）                     |
| axe-core critical / serious violations     | 未测 | 0                               |

---

## 9. Open Questions

1. **Bookmarklet 源码归属**：需要后端 PM 确认 bookmarklet 调用的鉴权方式（cookie / token / 一次性 code）？
2. **草稿冲突 UX**：当本地与服务端均有草稿且 `updatedAt` 接近时，是否需要给用户「保留哪一份」的选择？
3. **附件最大尺寸**：Photo 10MB / File 25MB 是否符合当前对象存储成本预算？
4. **详情页编译重试限频**：`recompile` 是否需要按 memo 限频（如 5 分钟内 1 次）？
5. **Voice 模式 ETA**：v0.6 还是 v0.7 交付？若已定 v0.6，本 PRD 是否需要预留前端接口形态？
6. **状态徽章 i18n**：当前文案为 `QUEUED / COMPILING / DONE / FAILED`，若 v0.6 启动 i18n，是否需要在本期就抽到 string table？

---

## 附：缺陷映射表

| 测试报告 BUG            | 对应 User Story          | 严重度    |
| ----------------------- | ------------------------ | --------- |
| BUG-01 草稿丢失         | US-001 + US-002          | 🔴 高     |
| BUG-02 ⌘+Enter          | US-003                   | 🟡 中     |
| BUG-03 卡片跳详情       | US-006 + US-007          | 🟡 中     |
| BUG-04 面包屑首帧       | US-004                   | 🟡 中     |
| BUG-05 QUEUED 文案      | US-005                   | 🟡 中     |
| BUG-06 Bookmarklet 异常 | US-011                   | 🟠 待确认 |
| BUG-07 URL 按钮行为     | US-008                   | 🟢 低     |
| BUG-08 Photo/File 无 UI | US-009 + US-010 + US-012 | 🟢 低     |
| BUG-09 渲染卡顿         | US-014                   | 🟢 低     |

---

## 实施优先级建议（落地顺序）

1. **P0（数据安全）**：US-001 → US-002 — 立刻阻断内容损失。
2. **P0（首帧一致）**：US-004 → US-005 — 一次性解决 SSR/CSR 同步类问题，影响面广。
3. **P1（核心闭环）**：US-007 → US-006 — 详情页先建，卡片再接入跳转。
4. **P1（输入效率）**：US-003 + US-015 — 快捷键 + 可达性一起做。
5. **P2（模式系统）**：US-008 → US-011 → US-013 → US-014 → US-009 → US-010 → US-012 — 按依赖与风险升序。
