import esbuild from 'esbuild';
import path from 'path';
import process from 'process';
import os from 'os';
import { builtinModules } from 'module';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'fs';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf-8').split('\n')) {
    const m = line.match(/^([^=]+)=["']?(.+?)["']?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const prod = process.argv[2] === 'production';

const vaultRaw = process.env.OBSIDIAN_VAULT || path.join(os.homedir(), 'Documents/Obsidian');
const vault = vaultRaw.replace(/^~(?=$|\/)/, os.homedir());
const pluginDir = existsSync(vault)
  ? path.join(vault, '.obsidian', 'plugins', 'copy-for-email')
  : null;

const copyToObsidian = {
  name: 'copy-to-obsidian',
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length > 0) return;
      if (!pluginDir) {
        console.warn(`[copy-to-obsidian] vault not found at ${vault}, skipping copy`);
        return;
      }
      if (!existsSync(pluginDir)) mkdirSync(pluginDir, { recursive: true });
      for (const f of ['main.js', 'manifest.json', 'styles.css']) {
        if (existsSync(f)) {
          copyFileSync(f, path.join(pluginDir, f));
          console.log(`[copy-to-obsidian] ${f} → ${pluginDir}`);
        }
      }
    });
  },
};

const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  plugins: [copyToObsidian],
  external: ['obsidian', 'electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
  format: 'cjs',
  target: 'es2022',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
});

if (prod) {
  await ctx.rebuild();
  process.exit(0);
} else {
  await ctx.watch();
}
