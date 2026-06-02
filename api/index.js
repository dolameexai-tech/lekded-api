const { createCanvas, loadImage } = require('canvas');
const cheerio = require('cheerio');

// ===== CONFIG =====
const WEBHOOK_URL = 'https://hook.us2.make.com/4h2y4m6j3f1cp5mnhu5sryqf5sprtq4a';
const IMGBB_API_KEY = 'f605ed92a832b0cda348f3d853d3611d';
const LEKDED_BG_URL = 'https://i.ibb.co/Kp8QgCWp/bg-bule1.png';
const STATE_KEY = 'lekded_vercel_corgi_0f8c'; // Unique secret key for keyvalue.immanuel.co

const ROUNDS = {
  xsmvip:  { time: '14:30', name: 'XSMVIP',  path: '/xsmvip', hour: 14, min: 30 },
  xsmbac:  { time: '15:30', name: 'XSMBAC',  path: '/xsmbac', hour: 15, min: 30 },
  xshnlc:  { time: '16:30', name: 'XSHNLC',  path: '/xshnlc', hour: 16, min: 30 },
  xsthin:  { time: '17:30', name: 'XSTHIN',  path: '/xsthin', hour: 17, min: 30 },
  xosolot: { time: '18:30', name: 'XOSOLOT', path: '/xosolot', hour: 18, min: 30 },
  xosona:  { time: '19:30', name: 'XOSONA',  path: '/xosona', hour: 19, min: 30 }
};

// State management
async function getLastPostedDate(roundKey) {
  try {
    const res = await fetch(`https://keyvalue.immanuel.co/api/KeyVal/GetValue/${STATE_KEY}/${roundKey}`);
    if (!res.ok) return null;
    const text = await res.text();
    return text.replace(/"/g, '').trim();
  } catch (e) { return null; }
}
async function setLastPostedDate(roundKey, dateStr) {
  try { await fetch(`https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${STATE_KEY}/${roundKey}/${dateStr}`, { method: 'POST' }); } catch (e) {}
}

function todayKey() {
  const n = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Vientiane" }));
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}
function fmtDate() {
  const n = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Vientiane" }));
  return `${String(n.getDate()).padStart(2, '0')}/${String(n.getMonth() + 1).padStart(2, '0')}/${n.getFullYear()}`;
}
function last3(n) {
  if (!n) return null;
  const s = String(n).replace(/[^0-9]/g, '');
  return s.length >= 3 ? s.slice(-3) : s.padStart(3, '0');
}
function nowHM() {
  const n = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Vientiane" }));
  return n.getHours() * 60 + n.getMinutes();
}

async function generateImage(info, db, g) {
  const W = 1098, H = 1279;
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');

  try {
    const bg = await loadImage(LEKDED_BG_URL);
    const ratio = Math.max(W / bg.width, H / bg.height);
    const drawW = bg.width * ratio;
    const drawH = bg.height * ratio;
    const offX = (W - drawW) / 2;
    const offY = (H - drawH) / 2;
    ctx.drawImage(bg, offX, offY, drawW, drawH);
  } catch (e) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#dc2626'); grad.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  }

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  ctx.font = 'bold 60px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(fmtDate(), 430, 376);
  
  ctx.font = 'bold 70px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(info.time, 880, 372);
  ctx.restore();

  function drawNumber(text, cx, cy, fillColor) {
    const fontSize = 140;
    const fontFamily = 'Impact, "Arial Black", sans-serif';

    ctx.save();
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 6;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 12;
    ctx.strokeText(text, cx, cy);

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = fillColor || '#dc2626';
    ctx.fillText(text, cx, cy);
    ctx.restore();
  }

  drawNumber(last3(db), 520, 595, '#dc2626');
  drawNumber(last3(g), 520, 865, '#dc2626');

  return c.toBuffer('image/png');
}

async function uploadImgBB(buffer) {
  const blob = new Blob([buffer], { type: 'image/png' });
  const fd = new FormData();
  fd.append('key', IMGBB_API_KEY);
  fd.append('image', blob, 'lottery.png');
  
  const x = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: fd
  });
  const d = await x.json();
  if (d.success) return d.data.url;
  throw new Error(JSON.stringify(d.error));
}

async function processRound(roundKey, reqForce) {
  const info = ROUNDS[roundKey];
  const roundMinutes = info.hour * 60 + info.min;
  
  if (reqForce !== 'true' && nowHM() < roundMinutes) {
    return { round: roundKey, status: 'skipped', reason: 'too_early' };
  }

  const postedDate = await getLastPostedDate(roundKey);
  const today = todayKey();
  if (postedDate === today && reqForce !== 'true') {
    return { round: roundKey, status: 'skipped', reason: 'already_posted_today' };
  }

  const htmlRes = await fetch(`https://xosolot.com${info.path}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const html = await htmlRes.text();
  const $ = cheerio.load(html);

  let db = null;
  let giai1 = null;
  
  $('table tr').each((i, el) => {
    const tds = $(el).find('td, th').map((j, td) => $(td).text().trim()).get();
    if (tds[0] === 'ĐB') db = tds[1];
    if (tds[0] === 'Giải 1') giai1 = tds[1];
  });

  const bodyText = $('body').text();
  const m1 = bodyText.match(/ngày\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  let tableDateMatches = false;
  
  if (m1) {
    const day = parseInt(m1[1]), mon = parseInt(m1[2]), year = parseInt(m1[3]);
    const n = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Vientiane" }));
    if (day === n.getDate() && mon === (n.getMonth() + 1) && year === n.getFullYear()) {
      tableDateMatches = true;
    }
  }

  const isXong = /XONG/i.test(bodyText);

  if (reqForce !== 'true') {
    if (!tableDateMatches) return { round: roundKey, status: 'skipped', reason: 'date_mismatch' };
    if (!isXong) return { round: roundKey, status: 'skipped', reason: 'not_xong' };
    if (!db || !giai1) return { round: roundKey, status: 'skipped', reason: 'missing_results' };
  } else {
    db = db || '000';
    giai1 = giai1 || '000';
  }

  const buffer = await generateImage(info, db, giai1);
  const imageUrl = await uploadImgBB(buffer);

  const cap = `ຜົນຫວຍ ຫວຽດນາມ 🇻🇳\n⏰ ຮອບເວລາ ${info.time}\n🗓 ງວດວັນທີ ${fmtDate()}`;
  const webhookRes = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: cap, image_url: imageUrl, round: roundKey,
      time: info.time, name: info.name, db, giai1,
      top: last3(db), bottom: last3(giai1), date: fmtDate(),
      page: 'SecondaryPage'
    })
  });

  if (!webhookRes.ok) throw new Error(`Webhook failed: ${await webhookRes.text()}`);

  await setLastPostedDate(roundKey, today);

  return { round: roundKey, status: 'success', db, giai1, image_url: imageUrl };
}

module.exports = async (req, res) => {
  const roundKey = req.query.round;
  
  try {
    if (roundKey) {
      if (!ROUNDS[roundKey]) return res.status(400).json({ error: 'Invalid round' });
      const result = await processRound(roundKey, req.query.force);
      return res.status(200).json(result);
    } else {
      // Process all rounds sequentially to avoid ImgBB rate limits or memory issues
      const results = [];
      for (const key of Object.keys(ROUNDS)) {
        try {
          const r = await processRound(key, req.query.force);
          results.push(r);
        } catch (e) {
          results.push({ round: key, status: 'error', error: e.message });
        }
      }
      return res.status(200).json({ results });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};
