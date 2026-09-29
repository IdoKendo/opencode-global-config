import assert from "node:assert/strict";
import plugin from "../../plugins/hebrew-rtl.ts";

const hooks = new Map();
const history = [];
await plugin.setup({
  session: {
    hook: async (name, callback) => { hooks.set(name, callback); },
    context: async () => history,
  },
});

const original = "שלום @קובץ\nEnglish @file";
const admission = {
  sessionID: "ses_test",
  messageID: "msg_test",
  delivery: "steer",
  metadata: { source: "test" },
  prompt: {
    text: original,
    files: [
      { uri: "file:///test", mention: { start: 5, end: 10, text: "@קובץ" } },
      { uri: "file:///other", mention: { start: 19, end: 24, text: "@file" } },
    ],
    agents: [{ name: "build", mention: { start: 5, end: 10, text: "@קובץ" } }],
    skills: [{ id: "test", mention: { start: 5, end: 10, text: "@קובץ" } }],
  },
};

await hooks.get("prompt")(admission);
assert.equal(admission.prompt.text, "ץבוק@ םולש\nEnglish @file");
assert.equal(admission.metadata.source, "test");
assert.equal(admission.prompt.files[0].uri, "file:///test");
assert.equal(admission.prompt.files[0].mention, undefined);
assert.deepEqual(admission.prompt.files[1].mention, { start: 19, end: 24, text: "@file" });
assert.equal(admission.prompt.agents[0].mention, undefined);
assert.equal(admission.prompt.skills[0].mention, undefined);

const display = admission.prompt.text;
history.push({
  type: "user",
  id: admission.messageID,
  text: display,
  metadata: admission.metadata,
  skills: [{ id: "test", text: display }],
});
for (const kind of ["context", "compaction", "generate"]) {
  // V2 resolves skill text before user prose and attachment contents after it.
  // Identical content guards against restoring the wrong text part.
  const event = {
    sessionID: admission.sessionID,
    system: [],
    messages: [
      {
        id: admission.messageID,
        role: "user",
        metadata: admission.metadata,
        content: [
          { type: "text", text: display },
          { type: "text", text: display },
          { type: "text", text: display },
        ],
      },
      { role: "assistant", content: [{ type: "text", text: display }] },
      { role: "user", content: [{ type: "text", text: display }] },
    ],
  };
  await hooks.get(kind)(event);
  assert.deepEqual(event.messages[0].content.map((part) => part.text), [display, original, display],
    `${kind}: restore only user prose, not skill or attachment text`);
  assert.equal(event.messages[1].content[0].text, display);
  assert.equal(event.messages[2].content[0].text, display);
  await hooks.get(kind)(event);
  assert.equal(event.messages[0].content[1].text, original, "request restoration is idempotent");
  if (kind === "context") {
    assert.ok(event.system.some((part) => part.text.includes("Hebrew terminal display workaround")));
  }
}
assert.equal(history[0].text, display, "request edits leave history unchanged");

const english = { prompt: { text: "English" }, metadata: { source: "test" } };
await hooks.get("prompt")(english);
assert.deepEqual(english, { prompt: { text: "English" }, metadata: { source: "test" } });
console.log("Hebrew V2 hook checks passed (prompt/context/compaction/generate; no title coverage).");
