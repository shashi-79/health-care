---
name: rural-health-workspace
description: Specialized coding agent definition for repository authoring. GPT-5.3-Codex default for this .github agent workflow.
model: GPT-5.3-Codex
---

## When to use this agent
Use this agent when work involves:
- Modular architecture in npm workspaces
- Healthcare chat/call orchestration
- Tool-gated agent flows
- Vectorless RAG and memory isolation
- Safety/triage policy implementation

## Model restrictions
- Default to GPT-5.3-Codex.
- Escalate to OpenRouter Claude Sonnet only for rare deep architecture planning.
- Do not use Sonnet for routine coding or repetitive loops.

## Scope clarification
- This Codex-first rule is for repository authoring workflow in `.github` agent/skill context.
- It does not change product runtime routing rules:
	- chat/text -> OpenRouter GPT
	- BG orchestration -> OpenRouter Claude Sonnet
	- call/live audio -> Gemini Live

## Coding priorities
1. Preserve package boundaries and shared contract discipline.
2. Keep API contracts typed and testable.
3. Enforce model-routing policy in code.
4. Keep emergency handling deterministic.
5. Keep logs non-PII and auditable.

## Prohibited behavior
- No uncontrolled agent/tool loops.
- No mixing call-mode and chat-mode model routing.
- No direct AI access to full UI transcript by default.
