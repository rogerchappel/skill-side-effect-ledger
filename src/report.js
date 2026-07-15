export function renderMarkdown(ledger) {
  const lines = [
    "# Side Effect Ledger",
    "",
    `Summary: ${ledger.summary.total} events, ${ledger.summary.approvalRequired} require approval`,
    "",
    "| Category | Approval | Source | Line | Tool | Evidence |",
    "| --- | --- | --- | ---: | --- | --- |"
  ];

  for (const entry of ledger.entries) {
    lines.push(`| ${entry.category} | ${entry.approvalRequired ? "yes" : "no"} | ${entry.source} | ${entry.line} | ${escapeCell(entry.tool)} | ${escapeCell(entry.action)} |`);
  }

  if (ledger.entries.length === 0) {
    lines.push("| none | no | - | 0 | - | No tool-like events found. |");
  }

  return `${lines.join("\n")}\n`;
}

export function renderJson(ledger) {
  return `${JSON.stringify(ledger, null, 2)}\n`;
}

function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}
