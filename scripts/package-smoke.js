import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "skill-side-effect-ledger-package-"));

try {
  const packOutput = execFileSync(
    "npm",
    ["pack", "--json", "--pack-destination", temporaryDirectory],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  const [{ filename }] = JSON.parse(packOutput);
  const tarball = join(temporaryDirectory, filename);

  execFileSync("tar", ["-xzf", tarball, "-C", temporaryDirectory], { stdio: "inherit" });

  const packageDirectory = join(temporaryDirectory, "package");
  for (const packagedPath of [
    "bin/skill-side-effect-ledger.js",
    "src/index.js",
    "fixtures/run.md",
  ]) {
    if (!existsSync(join(packageDirectory, packagedPath))) {
      throw new Error(`Packed artifact is missing ${packagedPath}`);
    }
  }

  execFileSync("npm", ["run", "smoke"], { cwd: packageDirectory, stdio: "inherit" });
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true });
}
