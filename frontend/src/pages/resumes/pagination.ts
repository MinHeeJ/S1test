export interface MeasuredBlock<T> {
  value: T;
  height: number;
}
/** Whole entries move to the next page; callers split only entries taller than a complete sheet. */
export function paginate<T>(
  blocks: MeasuredBlock<T>[],
  capacity: number,
): T[][] {
  const pages: T[][] = [[]];
  let used = 0;
  for (const block of blocks) {
    if (used + block.height > capacity && pages[pages.length - 1].length > 0) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(block.value);
    used += block.height;
  }
  return pages;
}
