import test from "node:test";
import assert from "node:assert/strict";
import { judgeCandidate } from "../src/judge.js";
test("judgeCandidate routes durable repo workflow to project scope", () => {
    const decision = judgeCandidate({
        cwd: "/tmp/example-repo",
        summary: "This repo should load durable memory before large implementations",
        body: "Current repo workflow: load durable memory before large implementations so implementation decisions keep the same project context."
    });
    assert.equal(decision.remember, true);
    if (!decision.remember) {
        return;
    }
    assert.equal(decision.item.scope, "project");
    assert.equal(decision.item.kind, "decision");
});
test("judgeCandidate routes global default rules to global scope", () => {
    const decision = judgeCandidate({
        summary: "Default preference: always ask Codex to search memory before planning",
        body: "This is a long-term default across repos and future sessions."
    });
    assert.equal(decision.remember, true);
    if (!decision.remember) {
        return;
    }
    assert.equal(decision.item.scope, "global");
    assert.equal(decision.item.kind, "preference");
});
test("judgeCandidate drops low-signal content", () => {
    const decision = judgeCandidate({
        summary: "tmp",
        body: ""
    });
    assert.deepEqual(decision, { remember: false, reason: "low_signal" });
});
//# sourceMappingURL=judge.test.js.map