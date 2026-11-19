---
name: design-interview
description: >-
  Interview the user about an unclear product or engineering decision. Use only when explicitly
  requested. Return a short decision brief before implementation.
disable-model-invocation: true
---

# Design Interview

Help the user choose between interpretations that would lead to different behavior or designs.

## Inspect first

Read the request and the relevant code, tests, and domain docs. Use the project's terms.
When exists, start with the shared context index and follow only the relevant references.
Distinguish what the system does today from what the user wants it to do.
If sources conflict, cite the conflict rather than silently choosing a side.

## Ask one decision at a time

Start with the unresolved choice that most affects the outcome. Use a concrete situation
where the options give different results. Explain the tradeoff and recommend an option when
the evidence supports one. Ask one question, wait for the answer, and use it to select the next.

For example: “An optimization is already active when the operator selects Pause. Should it
stay active, or should Pause undo it?” This settles what the control does before anyone designs it.

Skip questions the sources already answer. Explore edge cases, exclusions, and implementation
constraints only when they change a decision. If the user defers a choice, record it as open.
If there is no consequential ambiguity, go straight to the brief.

## Return a decision brief

Finish when the behavior is clear enough for the next task or the user asks to stop.
State the goal, agreed decisions and exclusions, and any open questions. Include a concrete
input and expected outcome when it helps a developer implement or review the agreement.
Keep recommendations distinct from decisions the user confirmed.

Return the brief in chat. Update an existing spec, glossary, or decision record only on request.
Stop at the brief; implementation is a separate task.
