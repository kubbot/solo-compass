# sc-loop — Solo Compass Dual-Agent Optimization Loop

> Orchestrator skill. Runs in the main conversation. Spawns Evaluator and
> Executor agents in alternation until score ≥ 99 or 10-round limit reached.

## Trigger

User types `/sc:loop` in the main conversation.
Optional: `/sc:loop resume=N` to continue from round N after a crash.

---

## Architecture

```
MAIN CONVERSATION (Orchestrator)
│
│  for round in 1..10:
│    ┌──────────────────────────────────────┐
│    │  EVALUATOR AGENT (foreground)        │
│    │  • xcodebuild                        │
│    │  • xcrun simctl install + launch     │
│    │  • 7 screenshots via xcrun           │
│    │  • static Swift audit (read-only)    │
│    │  • score 6 dims, max 100             │
│    │  → writes EVAL_REPORT.md            │
│    └──────────────────────────────────────┘
│           │ score ≥ 99 → DONE
│           ↓
│    ┌──────────────────────────────────────┐
│    │  EXECUTOR AGENT (foreground)         │
│    │  • reads EVAL_REPORT.md             │
│    │  • fixes P1 → P2 → P3               │
│    │  • xcodebuild verify                │
│    │  • reinstalls on simulator          │
│    │  → writes EXEC_LOG.md              │
│    └──────────────────────────────────────┘
│           │ round + 1
│           ↓ (repeat)
│
│  FINALIZE: print table, write LOOP_SUMMARY.md, offer git commit
```

---

## Step-by-Step Orchestrator Instructions

### 0. Init

```bash
mkdir -p /tmp/sc-loop
UDID=$(xcrun simctl list devices | grep Booted | grep -oE '[A-F0-9-]{36}' | head -1)
```

If UDID is empty → print:

```
❌ No booted simulator found.
   Open Simulator.app and boot an iPhone 17, then re-run /sc:loop
```

Stop.

Print to user:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SC-LOOP  solo-compass iOS
Simulator : {UDID}
Target    : 99 / 100
Max rounds: 10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Initialize tracking arrays in memory:

```
scores        = []   # int per round
fixes_applied = []   # int per round
build_results = []   # "✅" | "❌" per round
start_round   = 1    # or N if resume=N
```

If `resume=N`: read `/tmp/sc-loop/round_K/EVAL_REPORT.md` for K=1..(N-1)
to reconstruct scores[], then set start_round = N.

---

### 1. Evaluator Spawn (start of each round)

Read the full content of `.claude/skills/sc-evaluator/SKILL.md` and embed
it verbatim in the agent prompt below.

```python
result = Agent(
    description=f"SC Evaluator — round {N}",
    subagent_type="general-purpose",
    prompt=f"""
You are the Solo Compass Product Evaluator for round {N} of the optimization loop.

PROJECT ROOT : /Users/xiongxinwei/data/mine/cubxxw/personal/solo-compass
ROUND NUMBER : {N}
OUTPUT DIR   : /tmp/sc-loop/round_{N}/

== INSTRUCTIONS ==
{full contents of .claude/skills/sc-evaluator/SKILL.md}

== REQUIRED FINAL LINE ==
After writing /tmp/sc-loop/round_{N}/EVAL_REPORT.md, output exactly:
SCORE: <integer 0-100>
"""
)
```

Parse score from result: find line matching `SCORE: (\d+)`.
If not found, read `/tmp/sc-loop/round_{N}/EVAL_REPORT.md` and parse
the `**TOTAL**` row from the Score Summary table.

Append score to `scores[]`.

---

### 2. Termination Check (after each Evaluator)

```
prev_score = scores[-2] if len(scores) >= 2 else None
delta      = score - prev_score if prev_score else None

# Print round result
print(f"  Round {N} ▸ Score: {score}/100" +
      (f"  (+{delta})" if delta and delta > 0 else
       f"  ({delta})"  if delta and delta < 0 else
       f"  (no change)" if delta == 0 else ""))

# Stall detection: 3 rounds with delta == 0
if len(scores) >= 3 and all(s == scores[-1] for s in scores[-3:]):
    print("⚠️  Score unchanged for 3 consecutive rounds.")
    print("   Pausing — do you want to continue? (the loop will wait for your reply)")
    # Wait for user input before proceeding

if score >= 99:
    print(f"✅ Score {score}/100 — threshold reached!")
    goto FINALIZE

if N == 10:
    print(f"⚠️  Round 10 complete. Final score: {score}/100.")
    goto FINALIZE
```

---

### 3. Executor Spawn

Read full content of `.claude/skills/sc-executor/SKILL.md` and embed verbatim.

```python
exec_result = Agent(
    description=f"SC Executor — round {N}",
    subagent_type="general-purpose",
    prompt=f"""
You are the Solo Compass Optimization Executor for round {N}.

PROJECT ROOT : /Users/xiongxinwei/data/mine/cubxxw/personal/solo-compass
ROUND NUMBER : {N}
EVAL REPORT  : /tmp/sc-loop/round_{N}/EVAL_REPORT.md

== INSTRUCTIONS ==
{full contents of .claude/skills/sc-executor/SKILL.md}

== REQUIRED FINAL LINE ==
After writing /tmp/sc-loop/round_{N}/EXEC_LOG.md, output exactly:
FIXES: <int> applied, build <SUCCEEDED|FAILED>
"""
)
```

Parse fixes count and build result from `FIXES: (\d+) applied, build (\w+)`.
Append to `fixes_applied[]` and `build_results[]`.

Print:

```
  Executor  ▸ {fixes} fixes, build {✅|❌}
  → Round {N+1} starting...
```

Increment N. Go to step 1.

---

### FINALIZE

**Print score table:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Round │ Score │  Δ   │ Fixes │ Build
───────┼───────┼──────┼───────┼──────
   1   │  XX   │  —   │   Y   │  ✅
   2   │  XX   │ +DD  │   Y   │  ✅
   ...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Final score : {score} / 100
 Result      : {"PASSED ✅" if score >= 99 else "STOPPED — max rounds ⚠️"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Write `/tmp/sc-loop/LOOP_SUMMARY.md`:**

```markdown
# SC-Loop Summary

Completed : {ISO-8601 timestamp}
Rounds run: {N}
Final score: {score}/100
Threshold : 99/100
Result : PASSED | STOPPED (max rounds)

## Round History

| Round | Score | Delta | P1 Fixed | P2 Fixed | Build |
| ----- | ----- | ----- | -------- | -------- | ----- |
| 1     | XX    | —     | Y        | Z        | ✅    |

## Remaining Open Issues

{copy P1/P2/P3 from final EVAL_REPORT.md that are still open}

## Final Dimension Breakdown

| Dimension        | Score | Max     |
| ---------------- | ----- | ------- |
| A. Map-First     | X     | 20      |
| B. Features      | X     | 25      |
| C. Code Quality  | X     | 20      |
| D. UI/UX Polish  | X     | 15      |
| E. Accessibility | X     | 10      |
| F. Performance   | X     | 10      |
| **TOTAL**        | **X** | **100** |
```

**Offer git commit:**

```
Changed files:
{git diff --staged --stat output}

Commit with message:
  fix(ios): sc-loop {N} rounds — score {first_score}→{final_score}/100

  Automated dual-agent optimization.
  Fixed {total_P1} P1 issues, {total_P2} P2 issues across {N} rounds.

Commit now? Reply y to confirm.
```

Only run `git add apps/ios/SoloCompass/ && git commit` after explicit user "y".

---

## Error Handling

| Situation                               | Action                                                           |
| --------------------------------------- | ---------------------------------------------------------------- |
| Build FAILED in Evaluator (score=0)     | Spawn Executor — first job is to fix build                       |
| Executor build FAILED                   | Log ❌, continue to next round; Evaluator will catch regressions |
| SCORE line missing from agent output    | Parse EVAL_REPORT.md `**TOTAL**` row directly                    |
| FIXES line missing from executor output | Read EXEC_LOG.md `Summary` line                                  |
| Screenshot black / app not launched     | Evaluator scores affected dim 0 and notes it                     |
| Score unchanged 3 rounds in a row       | Pause and ask user whether to continue                           |
| No booted simulator                     | Print clear error, stop immediately                              |

---

## Resume Mode

`/sc:loop resume=3` means:

1. Read `/tmp/sc-loop/round_1/EVAL_REPORT.md` … `round_2/EVAL_REPORT.md`
2. Reconstruct `scores = [score_1, score_2]`, `fixes_applied`, `build_results`
3. Set `start_round = 3`
4. Continue the loop from round 3 as normal
