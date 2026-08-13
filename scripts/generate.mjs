import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.resolve(__dirname, '..');
const BASE_DIR = 'C:\\Users\\crore\\OneDrive - GS Engineering & Construction Corp\\GS-조경 동영상 관리';

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.avi', '.wmv', '.mkv', '.m4v', '.mts', '.m2ts', '.3gp', '.webm']);
const ARCHIVE_EXTS = new Set(['.zip', '.rar', '.7z']);

const CATEGORY_LABEL_FALLBACK = {
  '1': '준공전 동영상',
  '2': '1~3년차 대체식재 동영상',
  '3': '3년차 종결 식재전 동영상',
  '4': '3년차 종결 식재후 동영상',
};

function listDirs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

function countAcceptedFiles(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith('~$') || entry.name.toLowerCase() === 'desktop.ini') continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (VIDEO_EXTS.has(ext) || ARCHIVE_EXTS.has(ext)) count++;
  }
  return count;
}

function parseSiteFolder(name) {
  const m = name.match(/^(\d{2})\.(\d{2})\.(\d{2})\s+(.+)$/);
  if (!m) return null;
  const [, yy, mm, dd, siteName] = m;
  return { site: siteName.trim(), completionDate: `20${yy}-${mm}-${dd}` };
}

function parseCategoryFolder(name) {
  const m = name.match(/^([1-4])\.\s*(.+)$/);
  if (!m) return null;
  return { key: m[1], label: m[2].trim() };
}

function buildVendors() {
  const vendorDirs = listDirs(BASE_DIR).filter(n => n.endsWith('-GS현장별 조경동영상관리'));
  const vendors = [];

  for (const vendorDirName of vendorDirs) {
    const vendor = vendorDirName.replace(/-GS현장별 조경동영상관리$/, '');
    const vendorPath = path.join(BASE_DIR, vendorDirName);
    const siteDirNames = listDirs(vendorPath);
    const sites = [];

    for (const siteDirName of siteDirNames) {
      const parsed = parseSiteFolder(siteDirName);
      if (!parsed) {
        console.warn(`[skip] unrecognized site folder: ${vendorDirName}/${siteDirName}`);
        continue;
      }
      const sitePath = path.join(vendorPath, siteDirName);
      const catDirNames = listDirs(sitePath);
      const categories = {};
      for (const catDirName of catDirNames) {
        const cat = parseCategoryFolder(catDirName);
        if (!cat) continue;
        const fileCount = countAcceptedFiles(path.join(sitePath, catDirName));
        categories[cat.key] = {
          label: cat.label || CATEGORY_LABEL_FALLBACK[cat.key],
          uploaded: fileCount > 0,
          fileCount,
        };
      }
      sites.push({ site: parsed.site, completionDate: parsed.completionDate, categories });
    }

    vendors.push({ vendor, siteCount: sites.length, sites });
  }

  return vendors;
}

function main() {
  const vendors = buildVendors();
  const totalSites = vendors.reduce((a, v) => a + v.siteCount, 0);
  const totalItems = vendors.reduce(
    (a, v) => a + v.sites.reduce((b, s) => b + Object.keys(s.categories).length, 0), 0
  );
  const totalUploaded = vendors.reduce(
    (a, v) => a + v.sites.reduce((b, s) => b + Object.values(s.categories).filter(c => c.uploaded).length, 0), 0
  );

  const generatedAt = new Date().toISOString().slice(0, 10);
  const RAW = { totalUploaded, totalVendors: vendors.length, vendors, generatedAt, totalSites, totalItems };

  const templatePath = path.join(REPO_DIR, 'template.html');
  const outputPath = path.join(REPO_DIR, 'index.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const output = template.replace('__DASHBOARD_DATA__', JSON.stringify(RAW));
  fs.writeFileSync(outputPath, output, 'utf8');

  console.log(`vendors=${vendors.length} sites=${totalSites} items=${totalItems} uploaded=${totalUploaded} generatedAt=${generatedAt}`);
}

main();
