import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import {
  columnContentWidths,
  columnWidthFromPixels,
  displayWidth,
  formatDelimiterCell,
  minimumColumnWidth,
  parseColumnWidth,
} from "../src/rich-editor/domain/tableColumnWidths.js";

const require = createRequire(import.meta.url);
const host = require("../src/host/markdownStructure.js");
const { formatMarkdown } = require("../src/host/markdownFormatter.js");

describe("displayWidth", () => {
  it("counts East Asian wide characters as two columns, like the host", () => {
    for (const text of ["abc", "日本語", "ｱｲｳ", "名前 x", "😀", "é", "a\\|b", ""]) {
      expect(displayWidth(text)).toBe(host.displayWidth(text));
    }
  });
});

describe("columnContentWidths", () => {
  it("takes the widest cell of each column, never below three", () => {
    expect(columnContentWidths([["a", "日本語"], ["long text", "x"]], 3)).toEqual([9, 6, 3]);
  });
});

describe("parseColumnWidth", () => {
  it("treats three dashes or fewer as no width, whatever the alignment", () => {
    for (const cell of ["-", "---", ":---", ":---:", "---:", " --- "]) {
      expect(parseColumnWidth(cell, 3)).toBeNull();
    }
  });

  it("reads the delimiter cell length, colons included, as the width", () => {
    expect(parseColumnWidth("----", 3)).toBe(4);
    expect(parseColumnWidth(":------:", 3)).toBe(8);
    expect(parseColumnWidth(" ----------: ", 3)).toBe(11);
  });

  it("treats a delimiter padded to the content width as no width", () => {
    // This is what the table-format rule and Prettier write.
    expect(parseColumnWidth("---------", 9)).toBeNull();
    expect(parseColumnWidth(":-------:", 9)).toBeNull();
  });
});

describe("formatDelimiterCell", () => {
  it("writes three dashes when a column has no width", () => {
    expect(formatDelimiterCell("left", null, 9)).toBe("---");
    expect(formatDelimiterCell("center", null, 9)).toBe(":---:");
    expect(formatDelimiterCell("right", null, 9)).toBe("---:");
  });

  it("writes the width as the cell length, colons included", () => {
    expect(formatDelimiterCell("left", 12, 3)).toBe("------------");
    expect(formatDelimiterCell("center", 12, 3)).toBe(":----------:");
    expect(formatDelimiterCell("right", 12, 3)).toBe("-----------:");
  });

  it("keeps at least four dashes so the width is not read back as none", () => {
    expect(formatDelimiterCell("left", 2, 3)).toBe("----");
    expect(formatDelimiterCell("center", 2, 3)).toBe(":----:");
    expect(formatDelimiterCell("right", 2, 3)).toBe("----:");
  });

  it("adds one when the width matches the content width", () => {
    expect(formatDelimiterCell("left", 9, 9)).toBe("----------");
    expect(parseColumnWidth(formatDelimiterCell("center", 9, 9), 9)).toBe(10);
  });

  it("round-trips through parseColumnWidth", () => {
    for (const alignment of ["left", "center", "right"]) {
      for (const width of [minimumColumnWidth(alignment), 7, 20, 41]) {
        const cell = formatDelimiterCell(alignment, width, 3);
        expect(parseColumnWidth(cell, 3)).toBe(width);
      }
    }
  });
});

describe("minimumColumnWidth", () => {
  it("leaves room for four dashes plus the alignment colons", () => {
    expect(minimumColumnWidth("left")).toBe(4);
    expect(minimumColumnWidth("right")).toBe(5);
    expect(minimumColumnWidth("center")).toBe(6);
  });
});

describe("columnWidthFromPixels", () => {
  it("rounds to whole characters", () => {
    expect(columnWidthFromPixels(100, 8, "left")).toBe(13);
    expect(columnWidthFromPixels(96, 8, "left")).toBe(12);
  });

  it("never goes below the minimum width", () => {
    expect(columnWidthFromPixels(-50, 8, "left")).toBe(4);
    expect(columnWidthFromPixels(8, 8, "center")).toBe(6);
  });
});

describe("the table-format rule", () => {
  it("produces tables that read back as having no widths", () => {
    const formatted = formatMarkdown(
      "|a|名前|c|\n|:-|:-:|-:|\n|long text|日本語の説明|1|\n",
      { "table-format": true },
    );
    const lines = formatted.trimEnd().split("\n");
    const cells = (line) => line.split("|").slice(1, -1).map((cell) => cell.trim());
    const delimiter = cells(lines[1]);
    const contentWidths = columnContentWidths(
      [cells(lines[0]), cells(lines[2])],
      delimiter.length,
    );
    expect(delimiter.map((cell, column) => parseColumnWidth(cell, contentWidths[column]))).toEqual([
      null,
      null,
      null,
    ]);
  });
});
