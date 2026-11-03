import type { Request } from "express";
import { z, type ZodTypeAny } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const notFound = (what = "Resource") => new HttpError(404, `${what} not found`);
export const conflict = (msg: string) => new HttpError(409, msg);

/** Parse and validate part of a request with a Zod schema. Throws a 400 on failure. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(422, "Validation failed", result.error.flatten());
  }
  return result.data;
}

export const body = <S extends ZodTypeAny>(req: Request, s: S) => parse(s, req.body);
export const query = <S extends ZodTypeAny>(req: Request, s: S) => parse(s, req.query);

/** Route param as string (Express 5 types params loosely). */
export const param = (req: Request, name: string) => String(req.params[name]);
