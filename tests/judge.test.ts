import test from "node:test";
import assert from "node:assert/strict";
import { judgeCandidate } from "../src/judge";

test("judgeCandidate routes durable repo workflow to project scope with context retrieval", () => {
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
  assert.equal(decision.item.kind, "procedure");
  assert.equal(decision.item.retrieval, "context");
  assert.equal(decision.item.lifecycle, "active");
});

test("judgeCandidate routes global default rules to global always-load preference", () => {
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
  assert.equal(decision.item.retrieval, "always");
});

test("judgeCandidate marks plans for review and follow-up", () => {
  const decision = judgeCandidate({
    cwd: "/tmp/example-repo",
    summary: "Plan: split the memory daemon into ingestion and maintenance phases",
    body: "Next step roadmap for this repo: finish ingestion first, then schedule maintenance and stale-memory review."
  });

  assert.equal(decision.remember, true);
  if (!decision.remember) {
    return;
  }

  assert.equal(decision.item.kind, "plan");
  assert.equal(decision.item.lifecycle, "review");
  assert.equal(typeof decision.item.reviewAt, "number");
});

test("judgeCandidate uses query retrieval for sensitive candidate feedback", () => {
  const decision = judgeCandidate({
    cwd: "/tmp/example-repo",
    summary: "Candidate feedback should stay query-only",
    body: "Interview feedback for one candidate should remain durable, but it is confidential and should not auto-load into every context."
  });

  assert.equal(decision.remember, true);
  if (!decision.remember) {
    return;
  }

  assert.equal(decision.item.sensitivity, "sensitive");
  assert.equal(decision.item.retrieval, "query");
});

test("judgeCandidate rejects secrets", () => {
  const decision = judgeCandidate({
    summary: "Store the production API key",
    body: "api_key=super-secret"
  });

  assert.deepEqual(decision, { remember: false, reason: "secret_detected" });
});

test("judgeCandidate drops low-signal content", () => {
  const decision = judgeCandidate({
    summary: "tmp",
    body: ""
  });

  assert.deepEqual(decision, { remember: false, reason: "low_signal" });
});
