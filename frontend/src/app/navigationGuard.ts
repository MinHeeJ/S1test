let flush: (() => Promise<void>) | undefined;

/** The editor installs its real queue flush; failed flush blocks navigation and logout. */
export function registerNavigationFlush(
  handler: () => Promise<void>,
): () => void {
  flush = handler;
  return () => {
    if (flush === handler) flush = undefined;
  };
}

export async function flushBeforeNavigation(): Promise<void> {
  if (flush) await flush();
}
