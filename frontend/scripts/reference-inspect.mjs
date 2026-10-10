import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

await mkdir("evidence", { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const observations = [];
for (const path of ["/", "/auth/login", "/dashboard"]) {
  await page.goto(`https://rxresu.me${path}`, { waitUntil: "networkidle" });
  await page.screenshot({
    path: `evidence/reference-${path === "/" ? "home" : path.split("/").pop()}.png`,
  });
  observations.push(
    await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      text: document.body.innerText.slice(0, 9000),
      background: getComputedStyle(document.body).backgroundColor,
      buttons: [...document.querySelectorAll("button")]
        .slice(0, 12)
        .map((button) => ({
          text: button.innerText,
          radius: getComputedStyle(button).borderRadius,
          background: getComputedStyle(button).backgroundColor,
        })),
    })),
  );
}
const interactions = [];
await page.getByRole("button", { name: "Show password", exact: true }).click();
interactions.push({
  action: "Show password",
  inputType: await page.locator('input[name="password"]').getAttribute("type"),
});
await page.goto("https://rxresu.me/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^design$/i }).click();
interactions.push(
  await page.evaluate(() => ({
    action: "DESIGN navigation",
    url: location.href,
    scrollY,
  })),
);
await writeFile(
  "evidence/reference-interactions.json",
  JSON.stringify(interactions, null, 2),
);
await writeFile(
  "evidence/reference-observations.json",
  JSON.stringify(observations, null, 2),
);
console.log(JSON.stringify(observations, null, 2));
await browser.close();
