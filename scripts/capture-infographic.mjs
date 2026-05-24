// Captures the studio-workspace-overview.html to a 1200x900 PNG at 2x retina scale.
import puppeteer from 'puppeteer'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const HTML_PATH = 'C:/Users/leech/Desktop/스폰지클럽/spongeclub_1/02_mission/3주차_0524/6조/attachments/studio-workspace-overview.html'
const PNG_PATH  = 'C:/Users/leech/Desktop/스폰지클럽/spongeclub_1/02_mission/3주차_0524/6조/attachments/studio-workspace-overview.png'

const fileUrl = pathToFileURL(path.resolve(HTML_PATH)).href

// 3x retina (3600x2700 native PNG). 폰트 hinting=none + force-color-profile=srgb
// → ClearType/subpixel 노이즈 최소화, 가장 깨끗한 안티앨리어싱
const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1200, height: 900, deviceScaleFactor: 3 },
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--font-render-hinting=none',
    '--force-color-profile=srgb',
    '--enable-font-antialiasing',
    '--disable-lcd-text',  // subpixel 색번짐 제거 → 균일한 그레이스케일 안티앨리어싱
  ],
})

const page = await browser.newPage()
await page.goto(fileUrl, { waitUntil: 'networkidle0' })

// Wait for Noto Sans KR webfont to load + any paint to settle
await page.evaluate(async () => {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready
  }
})
await new Promise(r => setTimeout(r, 1200))

// Capture just the .frame element (excludes any stray html2canvas script artifacts)
const frame = await page.$('#frame')
if (!frame) {
  console.error('#frame not found')
  await browser.close()
  process.exit(1)
}
await frame.screenshot({ path: PNG_PATH, type: 'png', omitBackground: false })

await browser.close()
console.log('✓ Saved:', PNG_PATH)
