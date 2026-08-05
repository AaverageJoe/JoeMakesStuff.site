import { parse } from 'csv-parse/sync';
import fs from 'fs';

let raw = fs.readFileSync('C:\\Users\\joe.allison\\Downloads\\Project+Pages.csv', 'utf8');
raw = raw.replace(/^\uFEFF/, '');
const records = parse(raw, { columns: true, skip_empty_lines: true });

console.log('Total rows:', records.length);

const out = records.map(r => {
  let gallery = [];
  try { gallery = JSON.parse(r['Project Gallery'] || '[]'); } catch (e) { gallery = { error: e.message }; }
  return {
    title: r['Title'],
    page: r['Project Page'],
    client: r['Client: Name'],
    projectType: r['Project: Type'],
    intro1: r['Intro: Paragraph 1'],
    intro2: r['Intro: Paragraph 2'],
    devHeading: r['Development Heading'],
    devMessage: r['Development Message'],
    dev01: r['Dev01'],
    dev02: r['Dev02'],
    dev03: r['Dev03'],
    outcomesTitle: r['Outcomes Title'],
    outcomesMessage: r['Outcomes Message'],
    landingImage: r['LandingImage'],
    devVid: r['Dev Vid'],
    endCard: r['EndCard'],
    showcaseImage: r['Showcase_Image'],
    galleryCount: Array.isArray(gallery) ? gallery.length : gallery,
    status: r['Status'],
  };
});

fs.writeFileSync(
  'C:\\Users\\JOE~1.ALL\\AppData\\Local\\Temp\\claude\\D--Unity-Projects-SkateBoard-Project\\f2f46e67-f28f-44d4-939d-11efc7f9578d\\scratchpad\\parsed-projects.json',
  JSON.stringify(out, null, 2)
);
console.log('Wrote parsed-projects.json');
