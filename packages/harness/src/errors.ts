export class HarnessError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HarnessError";
  }
}

export function isHarnessError(e: unknown): e is HarnessError {
  return e instanceof HarnessError;
}
