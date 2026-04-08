const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const isWatch = process.argv.includes('--watch');

// Build-time asset baking: GLOSSARY.md → glossaryContent.ts
// See ARCHITECTURE.md §"Build-time asset baking"
function bakeGlossary() {
  const glossaryPath = path.join(__dirname, 'docs', 'GLOSSARY.md');
  const outPath = path.join(__dirname, 'src', 'webview', 'ui', 'pages', 'glossaryContent.ts');

  if (fs.existsSync(glossaryPath)) {
    const content = fs.readFileSync(glossaryPath, 'utf-8');
    const escaped = content.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
    fs.writeFileSync(outPath, `// Generated from docs/GLOSSARY.md — do not edit by hand\nexport const glossaryContent = \`${escaped}\`;\n`);
  }
}

bakeGlossary();

// Copy CSS and WASM to output directory
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
fs.copyFileSync(
  path.join(__dirname, 'src', 'webview', 'ui', 'styles.css'),
  path.join(__dirname, 'out', 'styles.css')
);
fs.copyFileSync(
  path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  path.join(__dirname, 'out', 'sql-wasm.wasm')
);

// Centralised version — read from package.json so there's one source of truth
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
const define = { '__APP_VERSION__': JSON.stringify(pkg.version) };

// Extension host bundle (Node.js context)
const extensionBuild = esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  minify: false,
  define,
  ...(isWatch ? { plugins: [watchPlugin('extension')] } : {}),
});

// Webview bundle (browser context)
const webviewBuild = esbuild.build({
  entryPoints: ['src/webview/ui/main.ts'],
  bundle: true,
  outfile: 'out/webview.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  minify: false,
  define,
  ...(isWatch ? { plugins: [watchPlugin('webview')] } : {}),
});

function watchPlugin(name) {
  return {
    name: `watch-${name}`,
    setup(build) {
      build.onEnd(result => {
        const errors = result.errors.length;
        const time = new Date().toLocaleTimeString();
        if (errors) {
          console.log(`[${time}] ${name}: ${errors} error(s)`);
        } else {
          console.log(`[${time}] ${name}: build succeeded`);
        }
      });
    },
  };
}

Promise.all([extensionBuild, webviewBuild]).then(() => {
  if (!isWatch) {
    console.log('Build complete.');
  }
}).catch(() => process.exit(1));
