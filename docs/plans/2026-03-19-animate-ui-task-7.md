# Task 7: Chat Panel Enhancements

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to plan
> the implementation steps for this task.

**Scope:** Add animations to the 6 chat panel components — message list, messages, tool calls, permissions, questions, provider selector
**Parent feature:** [Animate UI Integration Index](./2026-03-19-animate-ui-integration-index.md)

## Write Set

- Modify: `src/components/panels/ChatPanel.tsx` (~241 → ~280 lines — message list animations, send animation)
- Modify: `src/components/panels/ChatMessage.tsx` (~164 → ~200 lines — entrance animation, typing indicator)
- Modify: `src/components/panels/ChatToolCall.tsx` (~77 → ~110 lines — expand/collapse animation)
- Modify: `src/components/panels/ChatPermissionCard.tsx` (~283 → ~310 lines — card entrance, state transitions)
- Modify: `src/components/panels/ChatQuestionCard.tsx` (~223 → ~250 lines — card entrance, option animations)
- Modify: `src/components/panels/ChatProviderSelector.tsx` (~29 → ~55 lines — replace select with Dropdown Menu)

## Read Set (context needed)

- `src/components/panels/ChatPanel.tsx` — message list, input textarea, provider/permission/effort selectors, path bar
- `src/components/panels/ChatMessage.tsx` — user/assistant messages with nested events (thinking, tool calls, permissions, questions)
- `src/components/panels/ChatToolCall.tsx` — expandable tool call with args/result
- `src/components/panels/ChatPermissionCard.tsx` — state machine: pending → selecting → editing → approved/denied/interrupted
- `src/components/panels/ChatQuestionCard.tsx` — radio/checkbox options, free-text "Other" mode
- `src/components/panels/ChatProviderSelector.tsx` — plain HTML `<select>` for AI provider
- `src/components/ui/dropdown-menu.tsx` — animated Dropdown Menu from Task 3
- `src/components/ui/accordion.tsx` — animated Accordion from Task 3 (for tool call expand)
- `src/store/chatStore.ts` — chat state: messages, isStreaming, statusMessage

## Dependencies

- **Blocked by:** Task 3 (needs Dropdown Menu for provider selector, Accordion for tool calls)
- **Blocks:** None

## Description

The chat panel is a high-interaction area where animation significantly improves perceived responsiveness. Messages arriving from Claude should feel "alive," and interactive cards (permissions, questions) should draw appropriate attention.

### Per-component plan

**ChatPanel** — Message list container.
- Message list: new messages animate in from bottom with `AnimatePresence` (slide-up + fade)
- Auto-scroll: maintain existing scroll-to-bottom behavior, but the scroll itself can use `motion` smooth scroll
- Send button: press animation (already from Task 2's Button), plus a brief icon animation on send (arrow morphing or scale pulse)
- Status message area: `AnimatePresence` for the streaming status text (fade transitions between states)
- Input area: subtle focus ring animation (glow expansion)

**ChatMessage** — Individual message bubble.
- Entrance animation: user messages slide in from right, assistant messages slide in from left (150ms)
- Streaming text: no animation on individual characters (too expensive) — just the initial message entrance
- Thinking indicator: animated three-dot pulse (`motion.span` with staggered opacity keyframes) shown while Claude is thinking
- Event sections (tool calls, permissions, questions): each wrapped in `AnimatePresence` for smooth appearance as they stream in

**ChatToolCall** — Expandable tool call display.
- Replace current expand/collapse with animated Accordion-style transition
- Tool header: animated chevron rotation on expand/collapse
- Result area: height animation with `AnimatePresence`
- Error results: red-tinted background with subtle shake animation on error

**ChatPermissionCard** — Permission request card.
- Card entrance: scale-in + fade (draws attention, 200ms)
- State transitions: cross-fade between states (pending → selecting → editing → resolved)
- Suggestion pills: stagger entrance (each pill 50ms delay)
- Action buttons: "Always Allow" green pulse on hover, "Deny & Stop" red tint on hover
- Resolution: approved cards fade slightly (opacity 0.7), denied cards show strikethrough effect

**ChatQuestionCard** — Claude's questions with options.
- Card entrance: same as permission card (scale-in + fade)
- Options: stagger entrance (30ms per option)
- Radio/checkbox selection: animated indicator (checkmark draw for checkbox, dot scale for radio)
- "Other" mode toggle: content area slides down with `AnimatePresence`
- Submit: button loading state with spinner

**ChatProviderSelector** — Currently a plain `<select>`.
- Replace with Dropdown Menu from Task 3
- Provider items: show colored availability dot (green/gray) with animated presence
- Selected provider: display in trigger button with icon
- Menu open/close: scale + fade animation from Dropdown Menu primitive

### Animation timing guidelines

| Animation | Duration | Notes |
|-----------|----------|-------|
| Message entrance | 150ms | Direction depends on sender |
| Card entrance | 200ms | Scale-in, slightly longer to draw attention |
| Expand/collapse | 200ms | Accordion height animation |
| State transition | 150ms | Cross-fade |
| Thinking dots | 1200ms loop | 3 dots with 200ms stagger, continuous |
| Pill stagger | 50ms per item | Quick reveal |

### Acceptance criteria

- New chat messages animate in from the bottom
- Thinking indicator shows animated dots while Claude processes
- Tool calls expand/collapse smoothly
- Permission cards animate between states
- Question cards options stagger in
- Provider selector is a styled Dropdown Menu (not plain `<select>`)
- Streaming performance not degraded (no animation on per-character updates)
- `npm run build` and `npm run typecheck` pass
- Existing chat-related unit tests pass
- E2E bridge tests still pass (they test chat functionality, not animation)
