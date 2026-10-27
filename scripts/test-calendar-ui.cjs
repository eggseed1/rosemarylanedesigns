// Run with Playwright in CI. Fixtures remain test-only and never replace the feed.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = process.cwd();
const server = http.createServer((request, response) => {
  const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.join(root, name === '/' ? 'index.html' : name);
  if (!file.startsWith(root + path.sep)) {response.writeHead(403).end(); return;}
  const types = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4'};
  try {response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); response.end(fs.readFileSync(file));}
  catch {response.writeHead(404).end();}
});
const fixture = {
  schemaVersion: 1, status: 'ok', timeZone: 'America/New_York',
  updatedAt: '2026-10-27T01:00:00Z', rangeStart: '2026-09-01', rangeEnd: '2027-11-01',
  events: [
    {id:'one',title:'What’s the Point',description:'A first needlepoint class.\nBring your creativity.',location:'1685 Main St., Chatham',allDay:false,start:'2026-11-07T14:00:00-05:00',end:'2026-11-07T16:00:00-05:00',startDate:'2026-11-07',lastDate:'2026-11-07'},
    {id:'two',title:'A weekend of stitching',description:'<img src=x onerror=alert(1)>',location:'Cape Cod',allDay:true,start:'2026-11-14',end:'2026-11-16',startDate:'2026-11-14',lastDate:'2026-11-15'},
    {id:'three',title:'An evening together',description:'',location:'',allDay:false,start:'2026-11-22T22:00:00-05:00',end:'2026-11-23T00:00:00-05:00',startDate:'2026-11-22',lastDate:'2026-11-22'}
  ]
};
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  fs.mkdirSync('calendar-review', {recursive:true});
  const browser = await chromium.launch({headless:true});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Seoul'});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({time:new Date('2026-10-27T01:00:00Z')});
    await page.route('**/data/calendar.json', route => route.fulfill({json:fixture}));
    await page.goto(base, {waitUntil:'domcontentloaded'});
    await page.locator('#popup-calendar').scrollIntoViewIfNeeded();
    await page.locator('[data-calendar="content"]:not([hidden])').waitFor();
    assert.equal(await page.locator('[data-calendar="month"]').textContent(), 'November 2026');
    assert.equal(await page.locator('.rl-calendar__event').count(), 3);
    assert.match(await page.locator('.rl-calendar__event-time').first().textContent(), /2:00 PM – 4:00 PM/);
    assert.equal(await page.locator('[data-day="2026-11-15"]').count(), 1);
    assert.equal(await page.locator('[data-day="2026-11-16"]').count(), 0);
    assert.equal(await page.locator('[data-day="2026-11-23"]').count(), 0);
    await page.locator('#popup-calendar').screenshot({path:'calendar-review/desktop-fixture.png'});
    await page.locator('[data-day="2026-11-07"]').click();
    assert.equal(await page.locator('.rl-calendar__event').count(), 1);
    await page.locator('[data-calendar="reset"]').click();
    assert.equal(await page.locator('.rl-calendar__event').count(), 3);
    const link = await page.locator('.rl-calendar__save').first().getAttribute('href');
    assert.match(link, /20261107T190000Z%2F20261107T210000Z/);
    assert.equal(await page.locator('.rl-calendar__description img').count(), 0);
    await page.locator('[data-calendar="today"]').click();
    assert.equal(await page.locator('[data-calendar="month"]').textContent(), 'October 2026');
    assert.equal(await page.locator('[aria-current="date"]').textContent(), '26');
    assert.equal(await page.locator('.rl-calendar__empty').count(), 1);
    await page.locator('[data-calendar="previous"]').click();
    assert.equal(await page.locator('[data-calendar="previous"]').isDisabled(), true);
    await page.locator('[data-calendar="next"]').click();
    await page.locator('[data-calendar="next"]').click();
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('.rl-calendar__month').isVisible(), false);
    assert.equal(await page.locator('.rl-calendar__event').count(), 3);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('#popup-calendar').screenshot({path:'calendar-review/mobile-fixture.png'});
    await page.setViewportSize({width:320,height:700});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.route('**/data/calendar.json', route => route.fulfill({status:500,body:'unavailable'}));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('#popup-calendar').scrollIntoViewIfNeeded();
    await page.locator('.rl-calendar__fallback').waitFor();
    assert.equal(await page.locator('[data-calendar="content"]').isVisible(), false);
    assert.equal(errors.length,0, errors.join('\n'));
    await context.close();
    // Also capture the real sync result, with the actual current date.
    const live = await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'America/New_York'});
    await live.goto(base, {waitUntil:'domcontentloaded'});
    await live.locator('#popup-calendar').scrollIntoViewIfNeeded();
    await live.waitForFunction(() => document.querySelector('[data-calendar="content"]').hidden === false || !!document.querySelector('.rl-calendar__fallback'));
    await live.locator('#popup-calendar').screenshot({path:'calendar-review/desktop-live.png'});
    await live.setViewportSize({width:390,height:844});
    await live.locator('#popup-calendar').screenshot({path:'calendar-review/mobile-live.png'});
    console.log('Calendar UI passed: desktop, 390px, 320px, Eastern time in a different browser time zone, day filtering, navigation, all-day/midnight boundaries, safe text and feed failure.');
  } finally {await browser.close(); server.close();}
})().catch(error => {console.error(error); server.close(); process.exitCode=1;});
