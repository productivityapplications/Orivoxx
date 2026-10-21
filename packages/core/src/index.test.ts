import { describe, expect, it } from "vitest";

import { coreVersion } from "./index";

describe("coreVersion", () => {
  it("returns the package version", () => {
    expect(coreVersion()).toBe("0.1.0");
  });
});
