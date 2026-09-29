import { Plugin } from "@opencode/plugin"
import type { SessionRequest } from "@opencode/plugin/promise/session"

const HEBREW_RTL_HISTORY = "hebrewRtlHistory"

export default Plugin.define({
    id: "hebrew-rtl",
    async setup(ctx) {
        await ctx.session.hook("prompt", (event) => {
            const original = event.prompt.text
            if (!hasHebrew(original)) return

            const display = reverseHebrewSegments(original)
            event.prompt.text = display
            event.metadata = { ...event.metadata, [HEBREW_RTL_HISTORY]: { original, display } }

            // Reversal preserves total UTF-16 length, but can move individual mentions.
            for (const attachment of [
                ...(event.prompt.files ?? []),
                ...(event.prompt.agents ?? []),
                ...(event.prompt.skills ?? []),
            ]) {
                const mention = attachment.mention
                if (mention && display.slice(mention.start, mention.end) !== mention.text) {
                    delete attachment.mention
                }
            }
        })

        const restore = async (event: SessionRequest) => {
            if (!event.messages.some((message) => message.role === "user" && message.metadata?.[HEBREW_RTL_HISTORY])) return
            const history = await ctx.session.context({ sessionID: event.sessionID })
            event.messages = event.messages.map((message) => {
                if (message.role !== "user") return message
                const saved = message.metadata?.[HEBREW_RTL_HISTORY]
                if (!saved || typeof saved !== "object" || !("original" in saved) || !("display" in saved)) return message
                if (typeof saved.original !== "string" || typeof saved.display !== "string") return message

                const user = history.find((entry) => entry.id === message.id)
                if (user?.type !== "user") return message
                // V2 assembles resolved skills, user text, then file contents. Do not
                // restore matching Hebrew inside a skill or an attached document.
                const index = user.skills?.filter((skill) => skill.text !== undefined).length ?? 0
                const part = message.content[index]
                if (part?.type !== "text" || part.text !== saved.display) return message
                const content = [...message.content]
                content[index] = { ...part, text: saved.original }
                return { ...message, content }
            })
        }

        await ctx.session.hook("context", async (event) => {
            await restore(event)
            event.system.push({ type: "text", text: `
Hebrew terminal display workaround:
- When your response includes Hebrew prose, output each Hebrew-containing line in reverse character order.
- Example: write "?עמשנ המ םולש" instead of "שלום מה נשמע?".
- Do not reverse code blocks, file paths, commands, identifiers, or non-Hebrew text.
- This is only for terminal RTL display; preserve the intended meaning of the Hebrew sentence.
` })
        })
        await ctx.session.hook("compaction", restore)
        await ctx.session.hook("generate", restore)
    },
})

export function reverseHebrewSegments(text: string) {
    return text
        .split("\n")
        .map((line) => {
            const chars = Array.from(line)
            let index = 0

            while (index < chars.length) {
                if (!isHebrew(chars[index])) {
                    index++
                    continue
                }

                let start = index
                while (start > 0 && isLeadingNeutral(chars[start - 1])) start--

                let end = index
                let cursor = index + 1
                while (cursor < chars.length && !isStrongLtr(chars[cursor])) {
                    if (!isWhitespace(chars[cursor])) end = cursor
                    cursor++
                }

                reverseRange(chars, start, end)
                index = end + 1
            }

            return chars.join("")
        })
        .join("\n")
}

function reverseRange(chars: string[], start: number, end: number) {
    while (start < end) {
        const char = chars[start]
        chars[start] = chars[end]
        chars[end] = char
        start++
        end--
    }
}

function hasHebrew(text: string) {
    return /[\u0590-\u05ff]/.test(text)
}

function isHebrew(char: string) {
    const code = char.codePointAt(0) ?? 0
    return code >= 0x0590 && code <= 0x05ff
}

function isStrongLtr(char: string) {
    const code = char.codePointAt(0) ?? 0
    return (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)
}

function isWhitespace(char: string) {
    return /\s/.test(char)
}

function isLeadingNeutral(char: string) {
    return !isWhitespace(char) && !isHebrew(char) && !isStrongLtr(char)
}
