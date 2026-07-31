import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildLedger, classifyEvent, shouldFail } from "../src/index.js";

const commandCases = [
  ["git push origin main", "external-write", true],
  ["gh pr create --title update", "external-write", true],
  ["curl -X POST https://example.test/jobs", "external-write", true],
  ["curl --data '{\"ready\":true}' https://example.test/jobs", "external-write", true],
  ["npm publish", "external-write", true],
  ["git fetch origin", "external-read", false],
  ["curl https://example.test/jobs", "external-read", false],
  ["gh pr view 42", "external-read", false],
  ["echo hello > result.txt", "local-write", false],
  ["mkdir output", "local-write", false],
  ["git status --short", "local-read", false],
  ["rg TODO src", "local-read", false],
  ["frobnicate workspace", "unknown", false]
];

test("representative shell commands use their side-effect direction", () => {
  for (const [action, category, approvalRequired] of commandCases) {
    const actual = classifyEvent({ tool: "exec_command", action });
    assert.equal(actual.category, category, action);
    assert.equal(actual.approvalRequired, approvalRequired, action);
  }
});

test("tool semantics cover messaging without broad substring matches", () => {
  assert.equal(classifyEvent({ tool: "message", action: "send project update" }).category, "external-write");
  assert.equal(classifyEvent({ tool: "exec_command", action: "printf messenger" }).category, "unknown");
  assert.equal(classifyEvent({ tool: "exec_command", action: "echo http > notes.txt" }).category, "local-write");
});

test("markdown transcripts are classified into side-effect categories", async () => {
  const ledger = await buildLedger("fixtures/run.md");

  assert.equal(ledger.summary.total, 5);
  assert.equal(ledger.summary["local-read"], 1);
  assert.equal(ledger.summary["local-write"], 1);
  assert.equal(ledger.summary["external-read"], 1);
  assert.equal(ledger.summary["external-write"], 1);
  assert.equal(ledger.summary.unknown, 1);
  assert.equal(shouldFail(ledger), true);
});

test("jsonl events are classified conservatively", async () => {
  const ledger = await buildLedger("fixtures/run.jsonl");

  assert.equal(ledger.summary.total, 5);
  assert.equal(ledger.summary["external-write"], 1);
  assert.equal(ledger.summary.unknown, 1);
  assert.equal(shouldFail(ledger, "unknown"), true);
  assert.equal(shouldFail(ledger, "none"), false);
});

test("jsonl detection is case-insensitive", async () => {
  const directory = await mkdtemp(join(tmpdir(), "side-effect-ledger-"));
  const input = join(directory, "RUN.JSONL");
  await writeFile(input, '{"tool":"message","action":"send update"}\n');

  const ledger = await buildLedger(input);

  assert.equal(ledger.summary.total, 1);
  assert.equal(ledger.summary["external-write"], 1);
  assert.equal(ledger.entries[0].source, "jsonl");
});

test("jsonl entries retain physical line numbers across blank lines", async () => {
  const directory = await mkdtemp(join(tmpdir(), "side-effect-ledger-"));
  const input = join(directory, "lines.jsonl");
  await writeFile(input, '{"tool":"read","action":"cat file"}\n\nnot-json\n');

  const ledger = await buildLedger(input);

  assert.equal(ledger.entries[0].line, 1);
  assert.equal(ledger.entries[0].action, "cat file");
  assert.equal(ledger.entries[1].line, 3);
  assert.match(ledger.entries[1].action, /^invalid json: /);
});

test("GitHub Actions mutations require approval while reads do not", async () => {
  const ledger = await buildLedger("fixtures/github-actions.jsonl");

  assert.deepEqual(ledger.summary, {
    "local-read": 0,
    "local-write": 0,
    "external-read": 5,
    "external-write": 4,
    unknown: 1,
    total: 10,
    approvalRequired: 4
  });
  assert.deepEqual(
    ledger.entries.map(({ category, approvalRequired }) => ({ category, approvalRequired })),
    [
      { category: "external-write", approvalRequired: true },
      { category: "external-write", approvalRequired: true },
      { category: "external-write", approvalRequired: true },
      { category: "external-write", approvalRequired: true },
      { category: "external-read", approvalRequired: false },
      { category: "external-read", approvalRequired: false },
      { category: "external-read", approvalRequired: false },
      { category: "external-read", approvalRequired: false },
      { category: "external-read", approvalRequired: false },
      { category: "unknown", approvalRequired: false }
    ]
  );
});

test("cli exits non-zero on GitHub Actions mutations", () => {
  const result = spawnSync(
    process.execPath,
    [
      "bin/skill-side-effect-ledger.js",
      "--input",
      "fixtures/github-actions.jsonl",
      "--format",
      "json",
      "--fail-on",
      "external-write"
    ],
    { encoding: "utf8" }
  );

  assert.equal(result.status, 1);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.summary["external-write"], 4);
  assert.equal(parsed.summary.approvalRequired, 4);
});

test("cli emits markdown and exits non-zero on external writes", () => {
  const result = spawnSync(process.execPath, ["bin/skill-side-effect-ledger.js", "--input", "fixtures/run.md"], {
    encoding: "utf8"
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Side Effect Ledger/);
  assert.match(result.stdout, /external-write/);
});

test("cli can be configured as report-only", () => {
  const result = spawnSync(process.execPath, ["bin/skill-side-effect-ledger.js", "--input", "fixtures/run.jsonl", "--format", "json", "--fail-on", "none"], {
    encoding: "utf8"
  });

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.summary.total, 5);
});

test("cli argument errors use usage exit code without a stack trace", () => {
  for (const args of [["--bogus"], ["--format", "yaml"], ["--input"]]) {
    const result = spawnSync(process.execPath, ["bin/skill-side-effect-ledger.js", ...args], { encoding: "utf8" });

    assert.equal(result.status, 2, args.join(" "));
    assert.match(result.stderr, /^skill-side-effect-ledger: /);
    assert.doesNotMatch(result.stderr, /\n\s+at /);
    assert.equal(result.stdout, "");
  }
});

test("cli classifies representative command fixtures end to end", () => {
  const result = spawnSync(process.execPath, [
    "bin/skill-side-effect-ledger.js",
    "--input",
    "fixtures/commands.jsonl",
    "--format",
    "json",
    "--fail-on",
    "none"
  ], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.deepEqual(parsed.summary, {
    "local-read": 2,
    "local-write": 2,
    "external-read": 3,
    "external-write": 5,
    unknown: 1,
    total: 13,
    approvalRequired: 5
  });
});
