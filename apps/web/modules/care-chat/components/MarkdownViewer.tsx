"use client";

import React, { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

// Configure marked with GFM, breaks, custom renderers, and postprocess hooks
marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      return `<h${depth} class="md-heading md-h${depth}">${text}</h${depth}>\n`;
    },
    link({ href, title, tokens }) {
      const isPdfOrData =
        href.startsWith("data:") ||
        href.includes(".pdf") ||
        href.includes("/api/report/pdf");

      const text = this.parser.parseInline(tokens);
      const titleAttr = title ? ` title="${title}"` : "";
      const downloadAttr = isPdfOrData ? ` download="Medical_Report.pdf"` : "";
      const extraClass = isPdfOrData ? " markdown-pdf-link" : " markdown-link";

      return `<a href="${href}" target="_blank" rel="noopener noreferrer"${titleAttr}${downloadAttr} class="${extraClass}">${text}</a>`;
    }
  },
  hooks: {
    postprocess(html) {
      // Wrap any <table> in a responsive .table-wrap container
      return html.replace(/<table>[\s\S]*?<\/table>/g, (match) => `<div class="table-wrap">${match}</div>`);
    }
  }
});

function splitTabularLine(line: string): string[] | null {
  if (line.includes("\t")) {
    const parts = line.split("\t").map((c) => c.trim());
    if (parts.length >= 2 && parts.some((c) => c.length > 0)) {
      return parts;
    }
  }
  // Check for 3+ spaces column alignment (not code block or list)
  if (/^[^`#\-*].*\s{3,}.*/.test(line)) {
    const parts = line
      .split(/\s{3,}/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return parts;
    }
  }
  return null;
}

function convertTabularBlocksToMarkdown(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let inTableBlock = false;
  let tableRows: string[][] = [];

  function flushTable() {
    if (tableRows.length === 0) return;
    if (tableRows.length === 1 && tableRows[0].length < 2) {
      result.push(tableRows[0].join("    "));
      tableRows = [];
      return;
    }

    const maxCols = Math.max(...tableRows.map((r) => r.length));
    if (maxCols < 2) {
      for (const row of tableRows) {
        result.push(row.join("    "));
      }
      tableRows = [];
      return;
    }

    result.push("");
    for (let i = 0; i < tableRows.length; i++) {
      const row = tableRows[i];
      while (row.length < maxCols) {
        row.push("");
      }
      const cleanCells = row.map((c) => c.trim().replace(/\|/g, "\\|"));
      result.push(`| ${cleanCells.join(" | ")} |`);

      if (i === 0) {
        const delimiter = Array(maxCols).fill("---").join(" | ");
        result.push(`| ${delimiter} |`);
      }
    }
    result.push("");
    tableRows = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cells = splitTabularLine(line);

    if (cells) {
      // If an identical header row repeats inside the table block, skip the redundant header
      if (
        tableRows.length > 0 &&
        cells.join("|||").toLowerCase() === tableRows[0].join("|||").toLowerCase()
      ) {
        continue;
      }
      tableRows.push(cells);
      inTableBlock = true;
      continue;
    }

    if (inTableBlock) {
      flushTable();
      inTableBlock = false;
    }

    result.push(line);
  }

  if (tableRows.length > 0) {
    flushTable();
  }

  return result.join("\n");
}

function formatInlineLists(text: string): string {
  let res = text;

  // 1. Separate inline numbered list items: e.g. "something. 2. Next" -> "something.\n2. Next"
  res = res.replace(/([.!?])\s+(\d{1,2}\.)\s+/g, "$1\n$2 ");

  // 2. Separate inline bullet items: e.g. "something. - Next" or "something. • Next"
  res = res.replace(/([.!?])\s+([•\-\*])\s+/g, "$1\n- ");

  // 3. Separate common closing remarks that follow the last list item:
  const closingKeywords = [
    "Please let me know",
    "Let me know",
    "If anything changes",
    "If you have any questions",
    "Take care",
    "Feel free",
    "Hope this helps",
    "Note:",
    "Important:",
    "Remember:"
  ];
  const closingPattern = new RegExp(
    `([.!?])\\s+(${closingKeywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "g"
  );
  res = res.replace(closingPattern, "$1\n\n$2");

  // 4. If a line is followed by "2. ...", but doesn't have "1. ", add "1. " to start the ordered list
  const lines = res.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    const curr = lines[i].trim();
    const next = lines[i + 1].trim();
    if (next.startsWith("2. ") && !curr.startsWith("1. ") && curr.length > 0 && !curr.startsWith("#")) {
      lines[i] = `1. ${lines[i]}`;
    }
  }
  res = lines.join("\n");

  // 5. If there is a list header immediately before "1. " or "- ", ensure a blank line before the list starts
  res = res.replace(/([^\n]+)\n(1\.\s+|-\s+|•\s+)/g, "$1\n\n$2");

  return res;
}

function normalizeMarkdown(raw: string): string {
  if (!raw) return "";
  let text = raw;

  // 1. Separate inline dividers and headings onto their own lines:
  // e.g. "Some text --- ### Title" -> "Some text\n\n---\n\n### Title"
  text = text.replace(/([^\n])\s*(---|___|\*\*\*)\s*(#{1,6}\s+[^\n]+)/g, "$1\n\n$2\n\n$3");
  text = text.replace(/([^\n])\s+(---|___|\*\*\*)\s+([^\n]+)/g, "$1\n\n$2\n\n$3");
  text = text.replace(/([^\n])\s+(#{1,6}\s+[^\n]+)/g, "$1\n\n$2");

  // 2. Ensure space after '#' for ATX headings (e.g., "###Diagnosis" -> "### Diagnosis")
  text = text.replace(/^([ \t]*#{1,6})([^\s#\n])/gm, "$1 $2");

  // 3. Convert tab-separated or aligned tabular blocks into standard GFM tables
  text = convertTabularBlocksToMarkdown(text);

  // 4. Format inline lists into standard Markdown lists
  text = formatInlineLists(text);

  // 5. Ensure GFM table blocks have preceding empty line
  text = text.replace(/([^\n])\n([ \t]*\|?[^\n|]+\|.*?\n[ \t]*\|?[-: ]+[-| :]*\|)/g, "$1\n\n$2");

  // 6. Prevent loose horizontal rules from being treated as Setext header underlines
  text = text.replace(/([^\n])\n(---|___|\*\*\*)[ \t]*$/gm, "$1\n\n$2");

  return text;
}

export function MarkdownViewer({ content, className = "" }: MarkdownViewerProps) {
  const sanitizedHtml = useMemo(() => {
    if (!content) return "";
    try {
      const normalized = normalizeMarkdown(content);
      const rawHtml = marked.parse(normalized) as string;
      if (typeof window !== "undefined") {
        return DOMPurify.sanitize(rawHtml, {
          ADD_ATTR: ["target", "rel", "download", "class", "style", "align"],
          ADD_TAGS: ["table", "thead", "tbody", "tr", "th", "td", "div"]
        });
      }
      return rawHtml;
    } catch {
      return content;
    }
  }, [content]);

  if (!content) return null;

  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
