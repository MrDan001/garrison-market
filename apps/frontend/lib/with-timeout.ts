// lib/with-timeout.ts
// Wraps a promise so slow/dropped mobile connections fail loudly with a
// clear message instead of hanging the UI forever on "Saving...".

export function withTimeout<T>(
    promise: Promise<T>,
    ms: number = 30000,
    message: string = "This is taking longer than expected. Check your connection and try again."
  ): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;
  
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), ms);
    });
  
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
  }