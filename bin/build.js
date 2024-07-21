import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import zlib from 'zlib';
import { csv2json } from './lib/csv2json.js';
import { isFile } from './lib/isfile.js';
import { transcode } from './lib/transcode.js';

// `import.meta.url`からファイルパスを抽出する際の適切な処理
const __dirname = path.dirname(new URL(import.meta.url).pathname);
// Windowsの場合、パスの先頭に余分なスラッシュが付くため、それを取り除く
const dir = process.platform === 'win32' ? __dirname.substring(1) : __dirname;

const publicdir = path.join(dir, 'tiles');
fs.mkdirSync(publicdir, { recursive: true });

const url = 'https://cyberjapandata.gsi.go.jp/xyz/dem_png';
const mokurokuURL = `${url}/mokuroku.csv.gz`;

const log = path.join(path.dirname(path.dirname(import.meta.url).substring(7)), '.mokuroku.log');
let mokuroku = path.join(path.dirname(path.dirname(import.meta.url).substring(7)), 'mokuroku.csv');

if (!isFile(mokuroku)) {
  mokuroku = log;
}

let currentData;
if (isFile(mokuroku)) {
  currentData = csv2json(fs.readFileSync(mokuroku, 'utf-8'));
} else {
  currentData = {};
}

const meta = {
  "name": "Terrain-RGB DEM by GSI Japan",
  "format": "png",
  "attribution": "<a href=\"https://www.gsi.go.jp/\">GSI Japan</a>"
};

fs.writeFileSync(`${publicdir.replace(/\/$/, '')}/metadata.json`, JSON.stringify(meta));

fetch(mokurokuURL)
  .then(res => res.buffer())
  .then(buffer => {
    zlib.unzip(buffer, async (err, buffer) => {
      if (err) {
        console.error('Error unzipping data:', err);
        return;
      }

      const newData = csv2json(buffer.toString());
      for (const tile in newData) {
        if (!currentData[tile] || newData[tile][3] !== currentData[tile][3]) {
          try {
            const tileUrl = `${url.replace(/\/$/, '')}/${tile}`;
            const res = await fetch(tileUrl);
            const buffer = await res.buffer();

            const pngbuffer = transcode(buffer);

            const filename = path.join(publicdir, tile);
            fs.mkdirSync(path.dirname(filename), { recursive: true });
            fs.writeFileSync(filename, pngbuffer);

            fs.appendFileSync(log, newData[tile].join(',') + "\n");
            console.log(`${newData[tile][0]}: saved`);
          } catch (e) {
            console.log(`${newData[tile][0]}: error`);
            console.error(e);
          }
        } else {
          console.log(`${newData[tile][0]}: skip`);
        }
      }

      fs.writeFileSync(mokuroku, buffer.toString());

      if (isFile(log)) {
        fs.unlinkSync(log);
      }

      console.log('Done!');
    });
  });
