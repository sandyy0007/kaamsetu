export class ApiException extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) => new ApiException(400, "BAD_REQUEST", message, fields);
export const unauthorized = (message = "Please sign in to continue.") => new ApiException(401, "UNAUTHORIZED", message);
export const forbidden = (message = "You do not have permission to do this.") => new ApiException(403, "FORBIDDEN", message);
export const notFound = (what = "Item") => new ApiException(404, "NOT_FOUND", `${what} not found.`);
export const conflict = (message: string) => new ApiException(409, "CONFLICT", message);
export const tooMany = (message = "Too many requests. Please wait a moment and try again.") => new ApiException(429, "RATE_LIMITED", message);
