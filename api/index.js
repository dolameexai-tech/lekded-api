const { createCanvas, loadImage } = require('canvas');
const cheerio = require('cheerio');

// ===== CONFIG =====
const WEBHOOK_URL = 'https://hook.us2.make.com/4h2y4m6j3f1cp5mnhu5sryqf5sprtq4a';
const IMGBB_API_KEY = 'f605ed92a832b0cda348f3d853d3611d';
const LEKDED_BG_URL = 'https://i.ibb.co/Kp8QgCWp/bg-bule1.png';
const STATE_KEY = 'lekded_vercel_corgi_0f8c'; // Unique secret key for keyvalue.immanuel.co

const ROUNDS = {
  xsmvip:  { time: '14:30', name: 'XSMVIP',  path: '/xsmvip' },
  xsmbac:  { time: '15:30', name: 'XSMBAC',  path: '/xsmbac' },
  xshnlc:  { time: '16:30', name: 'XSHNLC',  path: '/xshnlc' },
  xsthin:  { time: '17:30', name: 'XSTHIN',  path: '/xsthin' },
  xosolot: { time: '18:30', name: 'XOSOLOT', path: '/xosolot' },
  xosona:  { time: '19:30', name: 'XOSONA',  path: '/xosona' }
};

// State management via free keyvalue API
async function getLastPostedDate(roundKey) {
  try {
    const res = await fetch(`https://keyvalue.immanuel.co/api/KeyVal/GetValue/${STATE_KEY}/${roundKey}`);
    if (!res.ok) return null;
    const text = await res.text();
    return text.replace(/"/g, '').trim();
  } catch (e) {
    console.error('State read error:', e);
    return null;
  }
}

async function setLastPostedDate(roundKey, dateStr) {
  try {
    await fetch(`https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${STATE_KEY}/${roundKey}/${dateStr}`, {
      method: 'POST'
    });
  } catch (e) {
    console.error('State write error:', e);
  }
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

// Generate Image using Node Canvas
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
    // Fallback gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#dc2626'); grad.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  }

  // Draw Date and Time
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

  // Draw Numbers helper
  function drawNumber(text, cx, cy, fillColor) {
    const fontSize = 140;
    const fontFamily = 'Impact, "Arial Black", sans-serif';

    ctx.save();
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 6;

    // Stroke
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 12;
    ctx.strokeText(text, cx, cy);

    ctx.shadowColor = 'transparent';

    // Fill
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

// Main API Handler
module.exports = async (req, res) => {
  // Allow ?round=xsmvip or post body
  const roundKey = req.query.round || 'xsmvip';
  const info = ROUNDS[roundKey];
  
  if (!info) {
    return res.status(400).json({ error: 'Invalid round' });
  }

  try {
    // 1. Check if already posted today
    const postedDate = await getLastPostedDate(roundKey);
    const today = todayKey();
    if (postedDate === today && req.query.force !== 'true') {
      return res.status(200).json({ status: 'skipped', reason: 'already_posted_today' });
    }

    // 2. Fetch xosolot html
    const htmlRes = await fetch(`https://xosolot.com${info.path}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    const html = await htmlRes.text();
    const $ = cheerio.load(html);

    // 3. Extract logic
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

    // 4. Validate
    if (req.query.force !== 'true') {
      if (!tableDateMatches) {
        return res.status(200).json({ status: 'skipped', reason: 'date_mismatch_or_not_found' });
      }
      if (!isXong) {
        return res.status(200).json({ status: 'skipped', reason: 'not_xong' });
      }
      if (!db || !giai1) {
        return res.status(200).json({ status: 'skipped', reason: 'missing_results' });
      }
    } else {
      // Force mode uses fallback if missing
      db = db || '000';
      giai1 = giai1 || '000';
    }

    // 5. Generate Image & Upload
    const buffer = await generateImage(info, db, giai1);
    const imageUrl = await uploadImgBB(buffer);

    // 6. Send to Make.com Webhook
    const cap = `ຜົນຫວຍ ຫວຽດນາມ 🇻🇳\n⏰ ຮອບເວລາ ${info.time}\n🗓 ງວດວັນທີ ${fmtDate()}`;
    const webhookRes = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: cap,
        image_url: imageUrl,
        round: roundKey,
        time: info.time,
        name: info.name,
        db,
        giai1,
        top: last3(db),
        bottom: last3(giai1),
        date: fmtDate(),
        page: 'SecondaryPage'
      })
    });

    if (!webhookRes.ok) {
      throw new Error(`Webhook failed: ${await webhookRes.text()}`);
    }

    // 7. Save state
    await setLastPostedDate(roundKey, today);

    return res.status(200).json({
      status: 'success',
      round: roundKey,
      db,
      giai1,
      image_url: imageUrl
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};
