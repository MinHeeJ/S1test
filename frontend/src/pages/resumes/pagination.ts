export interface ResumeBlock {
  section: string;
  heading?: string;
  lines: string[];
  photoId?: string | null;
  basics?: boolean;
}

/** Uses measured DOM height. Whole blocks move; only blocks taller than an A4 content area split. */
export function paginateBlocks(
  blocks: ResumeBlock[],
  capacity: number,
  measure: (block: ResumeBlock) => number,
): ResumeBlock[][] {
  const pages: ResumeBlock[][] = [[]];
  let used = 0;
  const append = (block: ResumeBlock) => {
    const height = measure(block);
    if (used + height > capacity && pages[pages.length - 1].length) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(block);
    used += height;
  };
  for (const block of blocks) {
    if (measure(block) <= capacity) {
      append(block);
      continue;
    }
    // Code-point chunks keep every character, including a single wrapped paragraph larger than a page.
    let remaining = block.lines.join("\n");
    let first = true;
    while (remaining.length) {
      const points = [...remaining];
      let low = 1;
      let high = points.length;
      let fitting = 1;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const candidate = {
          ...block,
          heading: first ? block.heading : undefined,
          photoId: first ? block.photoId : null,
          lines: points.slice(0, middle).join("").split("\n"),
        };
        if (measure(candidate) <= capacity) {
          fitting = middle;
          low = middle + 1;
        } else high = middle - 1;
      }
      append({
        ...block,
        heading: first ? block.heading : undefined,
        photoId: first ? block.photoId : null,
        lines: points.slice(0, fitting).join("").split("\n"),
      });
      remaining = points.slice(fitting).join("");
      first = false;
    }
  }
  return pages;
}
