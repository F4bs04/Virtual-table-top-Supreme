import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Helper to recursively copy directories
function copyFolderRecursiveSync(source, targetFolder) {
  const target = path.join(targetFolder, path.basename(source));
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  if (fs.lstatSync(source).isDirectory()) {
    const files = fs.readdirSync(source);
    files.forEach((file) => {
      const curSource = path.join(source, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, target);
      } else {
        fs.copyFileSync(curSource, path.join(target, file));
      }
    });
  }
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    {
      name: 'serve-model-dir',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Check if request is for Model directory
          const decodedUrl = decodeURIComponent(req.url.split('?')[0]);
          if (decodedUrl.startsWith('/Model/')) {
            const filePath = path.join(__dirname, decodedUrl);
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              res.setHeader('Content-Type', getMimeType(filePath));
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
          next();
        });
      },
      closeBundle() {
        // Copy Model directory to dist/Model on build
        const srcModelPath = path.join(__dirname, 'Model');
        const distPath = path.join(__dirname, 'dist');
        if (fs.existsSync(srcModelPath)) {
          console.log('Copying Model directory to dist...');
          copyFolderRecursiveSync(srcModelPath, distPath);
        }
      }
    }
  ]
})
