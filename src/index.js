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
  const tool = String(event.tool ?? "unknown").toLowerCase();
  const action = typeof event.action === "string" ? event.action : JSON.stringify(event.action);
  const command = action.trim().toLowerCase();
  const entry = {
    ...event,
    action,
    category: "unknown",
    approvalRequired: false,
    rationale: "Unrecognized action; reviewer should inspect it."
  };

  if (isExternalWrite(tool, command)) {
    return classified(entry, "external-write", true, "Action writes to an external system or notifies another person.");
  }

  if (isExternalRead(tool, command)) {
    return classified(entry, "external-read", false, "Action reads data from a remote or external source.");
  }

  if (isLocalWrite(tool, command)) {
    return classified(entry, "local-write", false, "Action mutates local workspace state.");
  }

  if (isLocalRead(tool, command)) {
    return classified(entry, "local-read", false, "Action reads local workspace state.");
  }

  return entry;
}

function classified(entry, category, approvalRequired, rationale) {
  return { ...entry, category, approvalRequired, rationale };
}

function isExternalWrite(tool, command) {
  if (/^(message|slack|email|send|publish|deploy|external-write)$/.test(tool)) return true;
  if (/^external-write(?:\s|$)/.test(command)) return true;
  if (/^connector[._-].*write$/.test(tool)) return true;
  if (/\bgit\s+push\b/.test(command)) return true;
  if (/\bgh\s+(?:pr|issue)\s+(?:create|edit|close|merge|comment|review)\b/.test(command)) return true;
  if (/\bgh\s+release\s+(?:create|edit|delete|upload)\b/.test(command)) return true;
  if (/\b(?:npm|pnpm|yarn)\s+publish\b/.test(command)) return true;
  if (/\bcurl\b/.test(command)) {
    const mutatingMethod = /(?:^|\s)(?:-x|--request)\s*(?:=|\s)\s*(?:post|put|patch|delete)\b/.test(command);
    const uploadsData = /(?:^|\s)(?:-d|--data(?:-ascii|-binary|-raw|-urlencode)?|--form)(?:\s|=)/.test(command);
    if (mutatingMethod || uploadsData) return true;
  }
  return false;
}

function isExternalRead(tool, command) {
  if (/^(web_fetch|web_search|browser|external-read)$/.test(tool)) return true;
  if (/^external-read(?:\s|$)/.test(command)) return true;
  if (/\bgit\s+(?:fetch|pull|clone|ls-remote)\b/.test(command)) return true;
  if (/\bgh\s+(?:pr|issue|release|run)\s+(?:list|view|status|checks|download)\b/.test(command)) return true;
  if (/\bcurl\b/.test(command)) {
    return !/(?:^|\s)(?:-x|--request)\s*(?:=|\s)\s*(?:post|put|patch|delete)\b/.test(command);
  }
  return false;
}

function isLocalWrite(tool, command) {
  if (/^(apply_patch|file_write|local-write)$/.test(tool)) return true;
  if (/(?:^|[^<])>{1,2}(?!>)/.test(command)) return true;
  if (/(?:^|[;&|]\s*|\s)(?:mkdir|touch|mv|rm|cp|install|truncate|tee)\b/.test(command)) return true;
  if (/\bgit\s+(?:add|commit|checkout|switch|merge|rebase|reset|restore|clean|worktree)\b/.test(command)) return true;
  if (/\b(?:npm|pnpm|yarn)\s+(?:install|add|remove|version)\b/.test(command)) return true;
  return false;
}

function isLocalRead(tool, command) {
  if (/^(read|file_fetch|local-read)$/.test(tool)) return true;
  if (/(?:^|[;&|]\s*|\s)(?:cat|sed|rg|grep|ls|find|head|tail|pwd|stat|wc)\b/.test(command)) return true;
  if (/\bgit\s+(?:status|diff|log|show|branch|rev-parse)\b/.test(command)) return true;
  return false;
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
