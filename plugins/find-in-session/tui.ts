import { Plugin } from "@opencode/plugin/tui"
import { Selection, type BaseRenderable, type Renderable, type ScrollBoxRenderable, type TextBufferRenderable } from "@opentui/core"

declare const Bun: { stringWidth(value: string): number }

function* walk(node: BaseRenderable): Generator<BaseRenderable> {
  if (!node.visible) return
  yield node
  for (const child of node.getChildren()) yield* walk(child)
}

// OpenCode has no public transcript handle. Its scrollbox owns rows keyed by message ID.
function transcript(root: Renderable, ids: Set<string>) {
  for (const node of walk(root)) {
    if ("viewport" in node && "scrollTo" in node && node.getChildren().some(row => ids.has(row.id))) {
      return node as ScrollBoxRenderable
    }
  }
}

type Hit = { text: TextBufferRenderable; x: number; y: number; endX: number; endY: number; preview: string }

function matches(box: ScrollBoxRenderable, query: string) {
  const result: Hit[] = []
  const literal = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu")
  for (const node of walk(box)) {
    if (!("plainText" in node && "lineInfo" in node)) continue
    const text = node as TextBufferRenderable
    const lines = text.plainText.split("\n")
    let visual = 0
    const { lineStartCols, lineSources } = text.lineInfo
    for (const [line, value] of lines.entries()) {
      for (const hit of value.matchAll(literal)) {
        while (visual + 1 < lineSources.length && lineSources[visual] < line) visual++
        const col = Bun.stringWidth(value.slice(0, hit.index))
        while (lineSources[visual + 1] === line && lineStartCols[visual + 1] <= col) visual++
        const end = col + Bun.stringWidth(hit[0])
        let last = visual
        while (lineSources[last + 1] === line && lineStartCols[last + 1] < end) last++
        result.push({
          text, x: text.x + col - lineStartCols[visual] - text.scrollX,
          y: text.y + visual - text.scrollY,
          endX: text.x + Math.max(col, end - 1) - lineStartCols[last] - text.scrollX,
          endY: text.y + last - text.scrollY,
          preview: value.slice(Math.max(0, hit.index - 16), hit.index + query.length + 24).trim(),
        })
      }
    }
  }
  return result
}

function highlight(hit: Hit) {
  // Apply a local selection so finding text doesn't trigger the terminal's copy-on-select.
  const selection = new Selection(hit.text, hit, { x: hit.endX, y: hit.endY })
  selection.isStart = true
  const previousBg = hit.text.selectionBg
  const previousFg = hit.text.selectionFg
  hit.text.selectionBg = "#ffdf00"
  hit.text.selectionFg = "#171717"
  hit.text.onSelectionChanged(selection)
  const range = hit.text.getSelection()
  return () => {
    if (hit.text.isDestroyed) return
    const current = hit.text.getSelection()
    if (range && current?.start === range.start && current.end === range.end) hit.text.onSelectionChanged(null)
    hit.text.selectionBg = previousBg
    hit.text.selectionFg = previousFg
  }
}

export default Plugin.define({
  id: "find-in-session",
  setup(ctx) {
    const frame = () => new Promise<void>(resolve => {
      ctx.renderer.once("frame", () => resolve())
      ctx.renderer.requestRender()
    })
    let search: { session: string; query: string; index: number } | undefined
    let generation = 0
    let clearHighlight: (() => void) | undefined
    const current = () => {
      const route = ctx.ui.router.current()
      return route.type === "session" ? route.sessionID : undefined
    }
    const notify = (message: string) => ctx.ui.toast.show({ message, variant: "info" })
    async function find(step: number, input?: string) {
      const session = current()
      if (!session) return
      const token = ++generation
      const active = () => generation === token && current() === session
      const previous = search?.session === session ? search : undefined
      const query = (step && previous ? previous.query : input || await ctx.ui.dialog.prompt({
        title: "Find in session", placeholder: "Search transcript text",
      }))?.trim()
      if (!query || !active()) return
      clearHighlight?.()
      clearHighlight = undefined
      try {
        const first = (await ctx.client.message.list({ sessionID: session, order: "asc", limit: 1 })).data[0]
        if (!active()) return
        if (!first) return notify("No messages to search")
        if (!ctx.data.session.message.get(session, first.id)) {
          ctx.keymap.dispatch("session.first")
          const deadline = Date.now() + 15000
          while (active() && !ctx.data.session.message.get(session, first.id)) {
            if (Date.now() > deadline) return notify("Session history is still loading. Try Find again.")
            await frame()
          }
          await frame()
          await frame()
        }
        if (!active()) return
        const messages = ctx.data.session.message.list(session).filter(m =>
          m.type === "assistant" || (m.type === "user" && m.text.trim()))
        const ids = new Set(messages.map(m => m.id))
        let box = transcript(ctx.renderer.root, ids)
        if (!box) return notify("No searchable transcript is displayed")
        // Message navigation mounts the full set of loaded rows in long sessions.
        if (messages.length && (!box.getRenderable(messages[0].id) || !box.getRenderable(messages.at(-1)!.id))) {
          ctx.keymap.dispatch("session.messages_last_user")
          for (let i = 0; i < 4 && active(); i++) await frame()
          if (!active()) return
          box = transcript(ctx.renderer.root, ids)
          if (!box) return notify("Transcript unavailable")
        }
        const hits = matches(box, query)
        const index = hits.length && step && previous
          ? ((previous.index + step) % hits.length + hits.length) % hits.length : 0
        search = { session, query, index }
        if (!hits.length) return notify(`No matches for “${query}”`)
        const hit = hits[index]
        clearHighlight = highlight(hit)
        box.scrollTo(Math.max(0, box.scrollTop + hit.y - box.viewport.y - 1))
        notify(`${index + 1}/${hits.length} · ${hit.preview}`)
      } catch (error) {
        if (active()) ctx.ui.toast.show({ message: `Find failed: ${String(error)}`, variant: "error" })
      }
    }
    ctx.keymap.layer(() => ({
      mode: "global",
      enabled: () => !!current(),
      commands: [
        { id: "find-in-session.open", title: "Find in session", slash: { name: "find", arguments: true }, bind: "<leader>f", palette: true, run: input => find(0, input) },
        { id: "find-in-session.next", title: "Find next", slash: { name: "find-next" }, bind: "f3", palette: true, run: () => find(1) },
        { id: "find-in-session.previous", title: "Find previous", slash: { name: "find-previous" }, bind: "shift+f3", palette: true, run: () => find(-1) },
      ],
      bindings: ["find-in-session.open", "find-in-session.next", "find-in-session.previous"],
    }))
    return () => {
      generation++
      clearHighlight?.()
    }
  },
})
