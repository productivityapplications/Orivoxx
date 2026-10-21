import { z } from "zod";

const WINDOWS_DRIVE_PATTERN = /^[A-Za-z]:/;

export const RelativePathSchema = z
  .string()
  .transform((value) => value.replace(/\\/g, "/"))
  .pipe(
    z
      .string()
      .min(1, "Path must not be empty.")
      .refine((value) => !value.includes("\0"), "Path must not contain NUL characters.")
      .refine((value) => !value.startsWith("/"), "Path must be relative.")
      .refine(
        (value) => !WINDOWS_DRIVE_PATTERN.test(value),
        "Path must not contain a Windows drive prefix.",
      )
      .refine(
        (value) => !value.split("/").some((segment) => segment === ".."),
        "Path must not contain traversal segments.",
      ),
  );
export type RelativePath = z.infer<typeof RelativePathSchema>;

export const IsoTimestampSchema = z.iso.datetime({ offset: true });
export type IsoTimestamp = z.infer<typeof IsoTimestampSchema>;
