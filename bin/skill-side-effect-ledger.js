#!/usr/bin/env node
import { buildLedger, shouldFail } from "../src/index.js";
import { renderJson, renderMarkdown } from "../src/report.js";

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input) {
    process.stdout.write("Usage: skill-side-effect-ledger --input <file> [--format markdown|json] [--fail-on unknown|external-write|none]\n");
    process.exit(args.help ? 0 : 2);
  }

  const ledger = await buildLedger(args.input);
  process.stdout.write(args.format === "json" ? renderJson(ledger) : renderMarkdown(ledger));
  process.exitCode = shouldFail(ledger, args.failOn) ? 1 : 0;
} catch (error) {
  process.stderr.write(`skill-side-effect-ledger: ${error.message}\n`);
  process.exitCode = 2;
}

function parseArgs(argv) {
  const parsed = {
    format: "markdown",
    failOn: "external-write"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--help" || token === "-h") parsed.help = true;
    else if (token === "--input") parsed.input = optionValue(argv, ++index, token);
    else if (token === "--format") parsed.format = optionValue(argv, ++index, token);
    else if (token === "--fail-on") parsed.failOn = optionValue(argv, ++index, token);
    else throw new Error(`Unknown option: ${token}`);
  }

  if (!["markdown", "json"].includes(parsed.format)) {
    throw new Error("--format must be markdown or json");
  }
  if (!["unknown", "external-write", "none"].includes(parsed.failOn)) {
    throw new Error("--fail-on must be unknown, external-write, or none");
  }

  return parsed;
}

function optionValue(argv, index, option) {
  const value = argv[index];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}
