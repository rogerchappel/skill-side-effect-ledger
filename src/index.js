import { readFile } from "node:fs/promises";

const CLASS_ORDER = ["local-read", "local-write", "external-read", "external-write", "unknown"];

export async function buildLedger(inputPath) {
  const text = await readFile(inputPath, "utf8");
  const events = inputPath.endsWith(".jsonl") ? parseJsonl(text) : parseMarkdown(text);
  const entries = events.map(classifyEvent);
  return {
    summary: summarize(entries),
    entries
  };
}

export function parseMarkdown(text) {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line: index + 1, raw: line.trim() }))
    .filter((event) => event.raw.length > 0)
    .map((event) => {
      const toolMatch = event.raw.match(/(?:tool|call|command):\s*(?<tool>[a-zA-Z0-9_.-]+)/i);
      const actionMatch = event.raw.match(/(?:action|args|input):\s*(?<action>.+)$/i);
      return {
        source: "markdown",
        line: event.line,
        tool: toolMatch?.groups?.tool ?? inferTool(event.raw),
        action: actionMatch?.groups?.action ?? event.raw
      };
    })
    .filter((event) => event.tool);
}

export function parseJsonl(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      try {
        const parsed = JSON.parse(line);
        return {
          source: "jsonl",
          line: index + 1,
          tool: parsed.tool ?? parsed.name ?? parsed.type ?? "unknown",
          action: parsed.action ?? parsed.command ?? parsed.args ?? parsed.input ?? parsed
        };
      } catch (error) {
        return {
          source: "jsonl",
          line: index + 1,
          tool: "unknown",
          action: `invalid json: ${error.message}`
        };
      }
    });
}

export function classifyEvent(event) {
  const haystack = `${event.tool} ${JSON.stringify(event.action)}`.toLowerCase();
  const entry = {
    ...event,
    action: typeof event.action === "string" ? event.action : JSON.stringify(event.action),
    category: "unknown",
    approvalRequired: false,
    rationale: "Unrecognized action; reviewer should inspect it."
  };

  if (/(message|slack|email|send|publish|deploy|gh release|release|connector.*write|external-write)/.test(haystack)) {
    return {
      ...entry,
      category: "external-write",
      approvalRequired: true,
      rationale: "Action may write to an external system or notify another person."
    };
  }

  if (/(web_fetch|web_search|browser|curl|http|get|external-read)/.test(haystack)) {
    return {
      ...entry,
      category: "external-read",
      approvalRequired: false,
      rationale: "Action reads data from a remote or external source."
    };
  }

  if (/(apply_patch|file_write|write|mkdir|mv|rm|git commit|npm version|local-write)/.test(haystack)) {
    return {
      ...entry,
      category: "local-write",
      approvalRequired: false,
      rationale: "Action may mutate local workspace state."
    };
  }

  if (/(cat|sed|rg|ls|git status|git diff|read|file_fetch|local-read)/.test(haystack)) {
    return {
      ...entry,
      category: "local-read",
      approvalRequired: false,
      rationale: "Action reads local workspace state."
    };
  }

  return entry;
}

export function shouldFail(ledger, failOn = "external-write") {
  if (failOn === "none") return false;
  if (failOn === "unknown") return ledger.entries.some((entry) => entry.category === "unknown");
  if (failOn === "external-write") return ledger.entries.some((entry) => entry.category === "external-write");
  throw new Error("--fail-on must be unknown, external-write, or none");
}

function summarize(entries) {
  const summary = Object.fromEntries(CLASS_ORDER.map((key) => [key, 0]));
  for (const entry of entries) {
    summary[entry.category] += 1;
  }
  summary.total = entries.length;
  summary.approvalRequired = entries.filter((entry) => entry.approvalRequired).length;
  return summary;
}

function inferTool(line) {
  const lower = line.toLowerCase();
  if (lower.includes("apply_patch")) return "apply_patch";
  if (lower.includes("exec_command") || lower.includes("$ ")) return "exec_command";
  if (lower.includes("web_search")) return "web_search";
  if (lower.includes("message")) return "message";
  return null;
}
