import { Plugin } from "@opencode/plugin/tui";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export default Plugin.define({
    id: "notification",
    setup(ctx) {
        const controller = new AbortController();
        const lastMessageBySession = new Map<string, string>();
        const isMainSessionCache = new Map<string, boolean>();

        async function notify(title: string, message: string) {
            const options = { signal: controller.signal };
            const soundEnabled = isEnvTrue(process.env.OPENCODE_SOUND_NOTIFICATION);
            if (process.platform === "darwin") {
                await run("osascript", ["-e", `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`], options);
                if (soundEnabled) {
                    await run("afplay", ["/System/Library/Sounds/Blow.aiff"], options).catch(() => {});
                }
            } else if (process.platform === "linux") {
                await run("notify-send", [title, message], options);
                if (soundEnabled) {
                    await run("paplay", ["/usr/share/sounds/freedesktop/stereo/complete.oga"], options).catch(() => {});
                }
            }
        }

        async function isMainSession(sessionID: string) {
            const cached = isMainSessionCache.get(sessionID);
            if (cached !== undefined) return cached;

            const session = ctx.data.session.get(sessionID) ?? await ctx.client.session.get({ sessionID });
            const isMain = !session.parentID;
            isMainSessionCache.set(sessionID, isMain);
            if (!isMain) lastMessageBySession.delete(sessionID);

            if (isMainSessionCache.size > 200) {
                const oldestSessionID = isMainSessionCache.keys().next().value;
                if (oldestSessionID) {
                    isMainSessionCache.delete(oldestSessionID);
                    lastMessageBySession.delete(oldestSessionID);
                }
            }
            return isMain;
        }

        let pending = Promise.resolve();
        const stop = ctx.data.listen(({ details: event }) => {
            const sessionID = event.type === "form.created" ? event.data.form.sessionID
                : "sessionID" in event.data && typeof event.data.sessionID === "string" ? event.data.sessionID : undefined;
            if (!sessionID || !event.location) return;
            const rootID = ctx.data.session.root(sessionID);
            const route = ctx.ui.router.current();
            const current = route.type === "session" && ctx.data.session.root(route.sessionID) === rootID;
            if (!current && !ctx.ui.tabs.list().some((tab) => tab.sessionID === rootID)) return;
            const eventLocation = event.location;

            pending = pending.then(async () => {
                if (controller.signal.aborted) return;
                const cached = ctx.data.session.get(sessionID);
                const session = cached?.location.directory === eventLocation.directory
                    ? cached : await ctx.client.session.get({ sessionID });
                const location = session.location;
                const workspaceID = "workspaceID" in eventLocation ? eventLocation.workspaceID : undefined;
                if (eventLocation.directory !== location.directory ||
                    workspaceID !== ("workspaceID" in location ? location.workspaceID : undefined) ||
                    controller.signal.aborted) return;

                switch (event.type) {
                    case "session.created":
                        isMainSessionCache.set(event.data.sessionID, !event.data.parentID);
                        break;
                    case "session.text.started":
                        lastMessageBySession.set(event.data.sessionID, "");
                        break;
                    case "session.text.delta":
                        lastMessageBySession.set(event.data.sessionID,
                            (lastMessageBySession.get(event.data.sessionID) ?? "") + event.data.delta);
                        break;
                    case "session.text.ended":
                        lastMessageBySession.set(event.data.sessionID, event.data.text);
                        break;
                    case "session.execution.succeeded":
                    case "session.execution.failed":
                    case "session.execution.interrupted":
                        if (event.type === "session.execution.interrupted" && event.data.reason === "shutdown") break;
                        if (await isMainSession(event.data.sessionID)) {
                            const message = getIdleSummary(lastMessageBySession.get(event.data.sessionID) ?? null) ?? "Idle";
                            await notify("opencode", message);
                        }
                        break;
                    case "form.created": {
                        const form = event.data.form;
                        const question = form.fields[0];
                        const header = question.title ?? form.title;
                        const message = question.description ?? question.title ?? form.title;
                        if (header && message) await notify(`Question: ${header}`, message);
                        break;
                    }
                    case "permission.asked":
                        await notify("opencode", "Permission required");
                        break;
                    case "session.deleted":
                        isMainSessionCache.delete(event.data.sessionID);
                        lastMessageBySession.delete(event.data.sessionID);
                        break;
                }
            }).catch((error) => {
                if (!controller.signal.aborted) console.error("Notification plugin:", error);
            });
        });

        return async () => {
            stop();
            controller.abort();
            await pending;
            lastMessageBySession.clear();
            isMainSessionCache.clear();
        };
    },
});

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
