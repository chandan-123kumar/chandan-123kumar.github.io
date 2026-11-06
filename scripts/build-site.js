import './build-sanitizer.js';
import {mkdir,cp,copyFile,rm} from 'node:fs/promises';
// Generated output only. Never copy the repository root or environment files.
await rm('public',{recursive:true,force:true});
await mkdir('public',{recursive:true});
for(const file of ['index.html','styles.css','script.js','chandan__resume.pdf']) await copyFile(file,`public/${file}`);
for(const dir of ['assets','blog','learn']) await cp(dir,`public/${dir}`,{recursive:true});
console.log('Built the existing website and /learn into public/.');
