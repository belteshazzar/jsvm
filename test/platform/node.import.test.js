import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runWithNodeImports } from "../../main.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(__dirname, "..", ".temp-node-test");

describe("Platform: Node.js Imports", () => {
  beforeEach(() => {
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.readdirSync(tempDir).forEach(f => {
        const fp = path.join(tempDir, f);
        fs.statSync(fp).isDirectory() ? fs.rmSync(fp, { recursive: true }) : fs.unlinkSync(fp);
      });
      fs.rmdirSync(tempDir);
    }
  });

  it("should load JSON module from filesystem", () => {
    const configPath = path.join(tempDir, "config.json");
    fs.writeFileSync(configPath, JSON.stringify({ name: "test", value: 123 }));

    const src = `
      import { name, value } from './config.json';
      print(name);
      print(value);
    `;

    const output = [];
    runWithNodeImports(src, {
      basePath: tempDir,
      onPrint: (s) => output.push(s),
    });

    expect(output).toEqual(["test", "123"]);
  });

  it("should load JavaScript module with require()", () => {
    const modulePath = path.join(tempDir, "helpers.json");
    fs.writeFileSync(
      modulePath,
      JSON.stringify({ result: 15, value: 42 })
    );

    const src = `
      import { result, value } from './helpers.json';
      print(result);
      print(value);
    `;

    const output = [];
    runWithNodeImports(src, {
      basePath: tempDir,
      onPrint: (s) => output.push(s),
    });

    expect(output).toEqual(["15", "42"]);
  });

  it("should resolve paths with different extensions", () => {
    const jsonPath = path.join(tempDir, "data.json");
    fs.writeFileSync(jsonPath, JSON.stringify({ loaded: true }));

    const src = `import { loaded } from './data'; print(loaded);`;

    const output = [];
    runWithNodeImports(src, {
      basePath: tempDir,
      extensions: [".json", ".js"],
      onPrint: (s) => output.push(s),
    });

    expect(output).toContain("true");
  });

  it("should handle relative paths within basePath", () => {
    const subPath = path.join(tempDir, "lib");
    fs.mkdirSync(subPath, { recursive: true });
    fs.writeFileSync(
      path.join(subPath, "util.json"),
      JSON.stringify({ type: "utility" })
    );

    const src = `import { type } from './util.json'; print(type);`;

    const output = [];
    runWithNodeImports(src, {
      basePath: subPath,
      onPrint: (s) => output.push(s),
    });

    expect(output).toContain("utility");
  });

  it("should throw on missing module", () => {
    const src = `import { x } from './missing.json'; print(x);`;

    expect(() => {
      runWithNodeImports(src, {
        basePath: tempDir,
        onPrint: () => {},
      });
    }).toThrow();
  });

  it("should handle nested object exports", () => {
    const configPath = path.join(tempDir, "nested.json");
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        server: { host: "localhost", port: 3000 },
      })
    );

    const src = `
      import { server } from './nested.json';
      print(server.host);
    `;

    const output = [];
    runWithNodeImports(src, {
      basePath: tempDir,
      onPrint: (s) => output.push(s),
    });

    expect(output).toContain("localhost");
  });

  it("should load multiple modules", () => {
    fs.writeFileSync(path.join(tempDir, "a.json"), JSON.stringify({ id: 1 }));
    fs.writeFileSync(path.join(tempDir, "b.json"), JSON.stringify({ id: 2 }));

    const src = `
      import { id as a } from './a.json';
      import { id as b } from './b.json';
      print(a + b);
    `;

    const output = [];
    runWithNodeImports(src, {
      basePath: tempDir,
      onPrint: (s) => output.push(s),
    });

    expect(output).toContain("3");
  });
});
