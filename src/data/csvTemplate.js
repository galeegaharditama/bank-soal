/**
 * Template for bulk entry. Comma separated like the sheet exports, analysed by src/data/csv.js.
 * Both example rows are drafts (aktif = tidak), so importing the file by mistake cannot publish them.
 */
const HEADER = 'mapel,kelas,bab,tipe,soal,gambar,opsi_a,opsi_b,opsi_c,opsi_d,jawaban,pembahasan,aktif';

const EXAMPLE_ROWS = [
  'Matematika,3,Pecahan,pg,"1/2 + 1/2 = ...",,1,2,1/4,3/4,A,"Dua setengah digabung menjadi satu.",tidak',
  'IPA,3,Wujud Benda,isian,"Es yang dipanaskan akan ...",,,,,,mencair|melebur,"Es berubah dari padat menjadi cair.",tidak',
];

export const TEMPLATE_FILE_NAME = 'template-soal.csv';

export function buildTemplateCsv() {
  return `${[HEADER, ...EXAMPLE_ROWS].join('\n')}\n`;
}
