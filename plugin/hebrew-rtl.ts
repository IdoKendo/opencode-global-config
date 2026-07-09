import type { Plugin } from "@opencode-ai/plugin"

const HEBREW_RTL_HISTORY = "hebrewRtlHistory"

export const HebrewRtlPlugin = (async () => {
    return {
        "chat.message": async (_input, output) => {
            for (const part of output.parts) {
                if (part.type !== "text") continue
                if (!hasHebrew(part.text)) continue

                part.text = reverseHebrewSegments(part.text)
                part.metadata = { ...part.metadata, [HEBREW_RTL_HISTORY]: true }
            }
        },
        "experimental.chat.messages.transform": async (_input, output) => {
            for (const message of output.messages) {
                if (message.info.role !== "user") continue

                for (const part of message.parts) {
                    if (part.type !== "text") continue
                    if (part.metadata?.[HEBREW_RTL_HISTORY] !== true) continue

                    part.text = reverseHebrewSegments(part.text)
                }
            }
        },
        "experimental.chat.system.transform": async (_input, output) => {
            output.system.push(`
Hebrew terminal display workaround:
- When your response includes Hebrew prose, output each Hebrew-containing line in reverse character order.
- Example: write "?עמשנ המ םולש" instead of "שלום מה נשמע?".
- Do not reverse code blocks, file paths, commands, identifiers, or non-Hebrew text.
- This is only for terminal RTL display; preserve the intended meaning of the Hebrew sentence.
`)
        },
    }
}) satisfies Plugin

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
