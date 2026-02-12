let lastMessage: { messageID: string | null; text: string | null } = {
    messageID: null,
    text: null,
};

type CommandRunner = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;

type RuntimeEvent = {
    type: string;
    properties?: {
        part?: {
            type?: string;
            messageID?: string | null;
            text?: string | null;
        };
    };
};

export const NotificationPlugin = async ({ $, project, client, directory, worktree }: {
    $: CommandRunner;
    project?: unknown;
    client?: unknown;
    directory?: unknown;
    worktree?: unknown;
}) => {
    void project;
    void client;
    void directory;
    void worktree;

    return {
        event: async ({ event }: { event: RuntimeEvent }) => {
            const platform = process.platform;
            const title = "opencode";
            const soundEnabled = isEnvTrue(process.env.OPENCODE_SOUND_NOTIFICATION);

            if (event.type === "message.part.updated") {
                const part = event.properties?.part;
                if (part?.type === "text") {
                    const { messageID = null, text = null } = part;
                    lastMessage = { messageID, text };
                }
            }

            if (event.type === "session.idle") {
                const msg = getIdleSummary(lastMessage?.text) ?? "Idle";

                if (platform === "darwin") {
                    await $`osascript -e 'display notification ${JSON.stringify(msg)} with title "${title}"'`;
                    if (soundEnabled) {
                        await $`afplay /System/Library/Sounds/Blow.aiff 2>/dev/null || true`;
                    }
                } else if (platform === "linux") {
                    await $`notify-send ${title} ${msg}`;
                    if (soundEnabled) {
                        await $`paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || true`;
                    }
                }
            }
        },
    }
}

function isEnvTrue(value?: string) {
    if (!value) return false;
    return ["1", "true", "yes", "y", "on"].includes(value.trim().toLowerCase());
}

function getIdleSummary(text: string | null) {
    if (!text) return;
    const idleMatch = text.match(/\[_\*\]Summary:\[_\*\]? (.*)\[_\*\]?$/m);
    if (idleMatch && idleMatch[1]) {
        return idleMatch[1].trim();
    }
    if (text.length > 80) {
        return text.slice(0, 80) + "...";
    }
    return text;
}
