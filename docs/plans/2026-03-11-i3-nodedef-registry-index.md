# Feature: I3 NodeDef System & Registry — Task Index

> **For Claude:** Invoke superpowers:writing-plans on each task file listed below.

**Goal:** Build the NodeDef schema, validator, loader, and layered registry with 32 built-in NodeDefs
**Total tasks:** 2
**Estimated scope:** ~45 files, ~362 source lines, ~970 config/YAML lines across all tasks

## Dependency Graph

Task 1: Schema + Validator + Registry   → blocks: [2]
Task 2: Built-in NodeDef YAML files     → blockedBy: [1]

## Execution Strategy

- **Sequential:** Task 1, then Task 2
- Task 2 depends on Task 1 because the built-in YAML files must pass Task 1's Zod schema validation and the loader smoke test validates all built-ins parse correctly.

## Tasks

| # | File | Scope | Write Files | Source LOC | Config LOC |
|---|------|-------|-------------|------------|------------|
| 1 | [./2026-03-11-i3-nodedef-registry-task-1.md](./2026-03-11-i3-nodedef-registry-task-1.md) | Schema, validator, loader, registry | 8 | ~362 | ~10 |
| 2 | [./2026-03-11-i3-nodedef-registry-task-2.md](./2026-03-11-i3-nodedef-registry-task-2.md) | 32 built-in NodeDef YAML files + barrel imports | ~42 | ~72 | ~960 |
