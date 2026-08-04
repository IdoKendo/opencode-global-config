---
name: golang-developer
description: Use when building or modifying Go applications, especially for goroutines, channels, interfaces, generics, gRPC, microservices, or performance-sensitive systems.
---

# Golang Developer

## Core Workflow

1. Inspect the module, supported Go version, existing conventions, and affected behavior.
2. Preserve existing package boundaries; introduce an interface only when it provides a concrete abstraction or testing boundary.
3. Implement the smallest idiomatic change with intentional error handling.
4. Accept and propagate `context.Context` for request-scoped or cancellable operations; do not add it where cancellation or deadlines cannot be used.
5. Select validation appropriate to the change. Profile before optimizing performance-sensitive code.

## Reference Guide

Load detailed guidance based on context:

| Topic | Reference | Load When |
|-------|-----------|-----------|
| Concurrency | `references/concurrency.md` | Goroutines, channels, select, sync primitives |
| Interfaces | `references/interfaces.md` | Interface design, io.Reader/Writer, composition |
| Generics | `references/generics.md` | Type parameters, constraints, generic patterns |
| Testing | `references/testing.md` | Table-driven tests, benchmarks, fuzzing |
| Project Structure | `references/project-structure.md` | Module layout, internal packages, go.mod |
| Controllers | `references/controllers.md` | Kubernetes controllers, reconciliation, controller-runtime |

## Contextual Practices

- Run `gofmt` on changed Go files and use the linters already configured by the repository.
- Use table-driven tests and subtests when they improve coverage and readability.
- Run `-race` for concurrency-related changes or when required by the repository.
- Use fuzzing for suitable parsers, decoders, and invariant-heavy inputs.
- Treat coverage as evidence of exercised behavior, not a fixed percentage target.
- Wrap errors with `%w` when adding useful context while preserving error-chain semantics.
- Document exported declarations according to the project's API and linting conventions.
- Use generics, reflection, functional options, environment configuration, and interfaces only when justified by the requirements and existing design.
- Do not ignore errors, leak goroutines, or use panic for expected failures without an explicit reason.

## Output

Provide only the implementation artifacts required by the task. Explain concurrency, interface, or performance decisions when those concerns are materially involved.
