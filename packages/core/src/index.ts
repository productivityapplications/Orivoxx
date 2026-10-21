export * from "./archive/index.js";
export * from "./contracts/index.js";
export * from "./graph/contracts/index.js";
export * from "./inventory/index.js";
export * from "./spec-parser/index.js";
export * from "./verify-input/index.js";

export function coreVersion(): string {
  return "0.1.0";
}
