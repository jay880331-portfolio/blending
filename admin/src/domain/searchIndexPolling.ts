type Schedule = (
  callback: () => void | Promise<void>,
  delay: number,
) => unknown;
type Cancel = (handle: unknown) => void;

export function startSearchIndexPolling(
  poll: () => Promise<boolean | undefined>,
  schedule: Schedule = (callback, delay) => setTimeout(callback, delay),
  cancel: Cancel = (handle) =>
    clearTimeout(handle as ReturnType<typeof setTimeout>),
) {
  let stopped = false;
  let inFlight = false;
  let handle: unknown;

  const tick = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      if ((await poll()) !== false && !stopped) handle = schedule(tick, 3000);
    } finally {
      inFlight = false;
    }
  };

  handle = schedule(tick, 3000);
  return () => {
    stopped = true;
    cancel(handle);
  };
}
