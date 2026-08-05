import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';

const CSV_PATH = 'C:\\Users\\joe.allison\\Downloads\\Project+Pages.csv';
const OUT_DIR = path.resolve('server/uploads/projects');
const MAX_VIDEO_BYTES = 8 * 1024 * 1024; // 8MB cap for self-hosted video

let raw = fs.readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '');
const records = parse(raw, { columns: true, skip_empty_lines: true });

function slugFromPage(page) {
  return decodeURIComponent(page.replace('/project-pages/', '')).replace(/\//g, '-');
}

function parseImageUri(uri) {
  if (!uri) return null;
  const m = uri.match(/^wix:image:\/\/v1\/([^/]+)\//);
  if (!m) return null;
  return { slug: m[1], ext: path.extname(m[1]).replace('~mv2', '') || path.extname(m[1]) };
}

function parseVideoUri(uri) {
  if (!uri) return null;
  const m = uri.match(/^wix:video:\/\/v1\/([^/]+)\//);
  const posterM = uri.match(/posterUri=([^&]+)/);
  if (!m) return null;
  return {
    videoId: m[1],
    posterSlug: posterM ? posterM[1] : null,
  };
}

function imageDownloadUrl(slug, width = 1000) {
  return `https://static.wixstatic.com/media/${slug}/v1/fill/w_${width},h_${width},al_c,q_85/${slug}`;
}

function extFromSlug(slug) {
  const m = slug.match(/~mv2\.(\w+)/) || slug.match(/\.(\w+)$/);
  return m ? m[1].toLowerCase() : 'jpg';
}

async function download(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  return buf.length;
}

async function headSize(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const len = res.headers.get('content-length');
    return len ? parseInt(len, 10) : null;
  } catch {
    return null;
  }
}

async function tryDownloadVideo(videoId, destPath) {
  for (const quality of ['480p', '720p']) {
    const url = `https://video.wixstatic.com/video/${videoId}/${quality}/mp4/file.mp4`;
    const size = await headSize(url);
    if (size !== null && size <= MAX_VIDEO_BYTES) {
      const written = await download(url, destPath);
      return { ok: true, quality, bytes: written };
    }
  }
  return { ok: false };
}

const manifest = [];

for (const r of records) {
  const slug = slugFromPage(r['Project Page']);
  const dir = path.join(OUT_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });

  const entry = { slug, title: r['Title'] };
  console.log(`\n=== ${slug} ===`);

  // showcase image (grid thumbnail)
  const showcase = parseImageUri(r['Showcase_Image']);
  if (showcase) {
    const ext = extFromSlug(showcase.slug);
    const dest = path.join(dir, `showcase.${ext}`);
    try {
      await download(imageDownloadUrl(showcase.slug, 900), dest);
      entry.showcase = `/uploads/projects/${slug}/showcase.${ext}`;
      console.log('showcase OK');
    } catch (e) {
      console.log('showcase FAIL', e.message);
    }
  }

  // banner: poster always, video if small
  const bannerVid = parseVideoUri(r['LandingImage']);
  if (bannerVid?.posterSlug) {
    const ext = extFromSlug(bannerVid.posterSlug);
    const dest = path.join(dir, `banner-poster.${ext}`);
    try {
      await download(imageDownloadUrl(bannerVid.posterSlug, 1400), dest);
      entry.bannerPoster = `/uploads/projects/${slug}/banner-poster.${ext}`;
      console.log('banner poster OK');
    } catch (e) {
      console.log('banner poster FAIL', e.message);
    }
  }
  if (bannerVid?.videoId) {
    const dest = path.join(dir, 'banner.mp4');
    const result = await tryDownloadVideo(bannerVid.videoId, dest);
    if (result.ok) {
      entry.bannerVideo = `/uploads/projects/${slug}/banner.mp4`;
      console.log(`banner video OK (${result.quality}, ${(result.bytes / 1024 / 1024).toFixed(1)}MB)`);
    } else {
      console.log('banner video SKIPPED (too large or unavailable)');
    }
  }

  // dev01/02/03
  entry.devImages = [];
  for (const key of ['Dev01', 'Dev02', 'Dev03']) {
    const img = parseImageUri(r[key]);
    if (!img) continue;
    const ext = extFromSlug(img.slug);
    const idx = entry.devImages.length + 1;
    const dest = path.join(dir, `dev${idx}.${ext}`);
    try {
      await download(imageDownloadUrl(img.slug, 1000), dest);
      entry.devImages.push(`/uploads/projects/${slug}/dev${idx}.${ext}`);
      console.log(`dev${idx} OK`);
    } catch (e) {
      console.log(`dev${idx} FAIL`, e.message);
    }
  }

  // dev video: poster + video if small
  const devVid = parseVideoUri(r['Dev Vid']);
  if (devVid?.posterSlug) {
    const ext = extFromSlug(devVid.posterSlug);
    const dest = path.join(dir, `devvid-poster.${ext}`);
    try {
      await download(imageDownloadUrl(devVid.posterSlug, 1000), dest);
      entry.devVidPoster = `/uploads/projects/${slug}/devvid-poster.${ext}`;
      console.log('devvid poster OK');
    } catch (e) {
      console.log('devvid poster FAIL', e.message);
    }
  }
  if (devVid?.videoId) {
    const dest = path.join(dir, 'devvid.mp4');
    const result = await tryDownloadVideo(devVid.videoId, dest);
    if (result.ok) {
      entry.devVidVideo = `/uploads/projects/${slug}/devvid.mp4`;
      console.log(`devvid video OK (${result.quality}, ${(result.bytes / 1024 / 1024).toFixed(1)}MB)`);
    } else {
      console.log('devvid video SKIPPED (too large or unavailable)');
    }
  }

  manifest.push(entry);
}

fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('\nDone. Wrote manifest.json');
