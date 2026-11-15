import { randomUUID } from "node:crypto";

import { ResultIdSchema, type ResultId } from "./contracts.js";

/** A fresh immutable result id. Runs are never updated, so ids are never reused. */
export function createResultId(): ResultId {
  return ResultIdSchema.parse(`res_${randomUUID().replace(/-/g, "").toLowerCase()}`);
}
