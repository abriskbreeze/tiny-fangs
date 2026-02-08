---
name: bugfix-sprint
description: Orchestrate parallel bug fix sprints with planning via Opus and implementation via Sonnet subagents. Use when given a list of bugs to fix in a codebase.
---

# Bug Fix Sprint Skill

Orchestrates bug fix sprints using the root cause / pattern analysis approach from AGENTS.md, with planning done by Opus and implementation by Sonnet subagents.

## When to Use

- User provides a list of bugs to fix
- Multiple bugs that can be parallelized
- Codebase has tests to verify fixes

## Workflow

### 1. Parse Bug List
Extract each bug into structured format:
```
BUG-ID: Short name
Symptoms: What user sees
Root Cause: (to be filled during planning)
Pattern: What allowed this bug to exist?
Acceptance: How to verify it's fixed
Files: Likely files to modify
```

### 2. Root Cause Analysis (Opus)
For EACH bug, ask:
1. Am I solving symptoms or ROOT problems in the architecture/design?
2. What pattern in the codebase allowed this bug to exist?
3. What breaks if we revert this fix in the future?

Group bugs by affected system:
- Trigger/Effect system bugs
- UI/Visual bugs
- Game flow/AI bugs
- Text/Content fixes

### 3. Write Plan
Create/update `tasks/todo.md` with:
- Full bug list with root cause analysis
- Grouped by system/area
- Subagent assignments (3-5 agents max)
- Verification checklist

### 4. Spawn Subagents
For each group, spawn a Sonnet subagent:
```javascript
sessions_spawn({
  task: `## Bug Fix — Group Name

You are fixing bugs in [project] at [path].

**Read first:**
- tasks/todo.md for full bug descriptions
- [MEMORY.md or relevant context files]
- [Key source files]

**Your bugs:**
[List bugs with root cause and fix approach]

**Guidelines:**
- Run tests after changes
- Surgical changes only
- Update MEMORY.md with patterns learned`,
  model: "sonnet",
  label: "bugfix-[group-name]"
});
```

### 5. Monitor & Collect
- Subagents ping back when done
- Collect summaries
- Run full test suite
- Provide comprehensive overview

## Key Principles

### From AGENTS.md
- **Root Cause Check (MANDATORY)**: Before ANY fix, ask the three questions
- **Surgical Changes**: Touch only what's necessary
- **Verify Before Done**: Tests must pass

### From Karpathy Guidelines
- Simplicity first — minimum code that solves the problem
- State assumptions explicitly
- Define verifiable success criteria

## Example Usage

User says:
```
fix these bugs: 
1. Pulsefin deals 120 damage instead of 60
2. AI casts healing spells without active creature
3. Battle log shows oldest first instead of newest
```

Agent:
1. Parses into 3 structured bugs
2. Analyzes root causes (Opus thinking)
3. Groups: [Damage system], [AI behavior], [UI]
4. Writes plan to tasks/todo.md
5. Spawns 3 Sonnet subagents
6. Monitors completion
7. Runs tests, provides summary
