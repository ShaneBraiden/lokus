// One-off: converts the canon-safe images from the AI Studio export to WebP for the web app.
// Excluded on purpose: cta_binders_desk (shows "CT-450-2023, Phase II, Site #112") and workday2_cro_backdrop
// ("ACME CRO" branding) — both contradict the AHS-DM-026 / Aurous Healthcare canon.
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const src = path.resolve('_import/northrsim-remix/src/assets/images');
const out = path.resolve('apps/web/src/assets/images');
mkdirSync(out, { recursive: true });
const jobs = [
  ['unbranded_clinical_workplace_1792037756103.jpg', 'workplace.webp', 1600],
  ['cro_workstation_view_1792583310385.jpg', 'office.webp', 1600],
  ['workday2_desk_email_1792823050379.jpg', 'desk-email.webp', 1600],
  ['clinical_office_backdrop_1792581364118.jpg', 'quiet-desk.webp', 1400],
  ['dr_anjali_portrait.png', 'dr-anjali.webp', 480],
];
for (const [from, to, width] of jobs) {
  await sharp(path.join(src, from)).resize({ width, withoutEnlargement: true }).webp({ quality: 72 }).toFile(path.join(out, to));
  console.log(to, Math.round(statSync(path.join(out, to)).size / 1024), 'KB');
}
