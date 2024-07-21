import fs from 'fs';

export const isFile = (file) => {
  try {
    fs.statSync(file);
    return true;
  } catch(err) {
    if(err.code === 'ENOENT') return false;
  }
}
