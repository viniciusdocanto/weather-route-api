const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const sass = require('sass');
const sharp = require('sharp');
const chokidar = require('chokidar');
// Tenta carregar do arquivo local .env (Desenvolvimento)
if (fs.existsSync(path.join(__dirname, '.env'))) {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
} else {
    require('dotenv').config();
}

// Tentativa 1: Verifica se estamos num servidor de Produção (ex: Render) e tem variáveis de ambiente injetadas no SO central.
// (Render usa NODE_ENV = 'production' por padrão)
const isProd = process.env.NODE_ENV === 'production';

// Se API_BASE_URL nao for definido no .env, usamos fallbacks neutros
let API_BASE = process.env.API_BASE_URL;

if (!API_BASE) {
    API_BASE = isProd ? '/api' : 'http://localhost:3000/api';
}

// Pela a versão real do package.json para injetar sem precisar de fecth na API
const APP_VERSION = require('./package.json').version;

console.log('🚧 Iniciando Build do Frontend...');
console.log(`🏷️  Injetando APP_VERSION: ${APP_VERSION}`);

// 0. Automação de Cache Busting (Injeta versão no index.html)
function injectVersion() {
    try {
        const filePath = path.join(__dirname, 'index.html');
        let content = fs.readFileSync(filePath, 'utf8');

        // Atualiza query string de versão para CSS e JS
        content = content.replace(/style\.min\.css\?v=[\w.-]+/g, `style.min.css?v=${APP_VERSION}`);
        content = content.replace(/script\.min\.js\?v=[\w.-]+/g, `script.min.js?v=${APP_VERSION}`);

        fs.writeFileSync(filePath, content);
        console.log(`✅ Versionamento (v${APP_VERSION}) injetado no index.html`);
    } catch (err) {
        console.error('❌ Erro ao injetar versão no HTML:', err);
    }
}

// 1. Build do JavaScript
const isWatchMode = process.argv.includes('--watch');

async function buildJS() {
    try {
        const ctx = await esbuild.context({
            entryPoints: ['src/js/script.js'],
            bundle: true,
            minify: true,
            outfile: 'assets/js/script.min.js',
            define: {
                // Versão e URL da API injetadas no build
                'process.env.APP_VERSION': JSON.stringify(APP_VERSION),
                'process.env.API_BASE_URL': JSON.stringify(API_BASE)
            }
        });

        if (isWatchMode) {
            await ctx.watch();
            console.log('👀 Observando mudanças no JS...');
        } else {
            await ctx.rebuild();
            await ctx.dispose();
            console.log('✅ Build do Javascript concluído com sucesso!');
        }
        injectVersion();
    } catch (err) {
        console.error('❌ Erro no build do JS:', err);
        if (!isWatchMode) process.exit(1);
    }
}
buildJS();

// 2. Build do SCSS com Tailwind CSS (PostCSS)
async function buildCSS() {
    try {
        if (!fs.existsSync('src/scss/style.scss')) {
            console.warn('⚠️ scss não encontrado, ignorando sass build');
            return;
        }

        const sassResult = sass.compile('src/scss/style.scss');

        const postcss = require('postcss');
        const tailwindcss = require('tailwindcss');
        const autoprefixer = require('autoprefixer');

        const postcssResult = await postcss([
            tailwindcss,
            autoprefixer
        ]).process(sassResult.css, { from: 'src/scss/style.scss', to: 'assets/css/style.min.css' });

        if (!fs.existsSync('assets/css')) fs.mkdirSync('assets/css', { recursive: true });

        const finalMinified = await esbuild.transform(postcssResult.css, { loader: 'css', minify: true });

        fs.writeFileSync('assets/css/style.min.css', finalMinified.code);
        console.log('✅ Compilação SCSS + Tailwind + Minificação concluída...');
        injectVersion();

    } catch (err) {
        console.error('❌ Erro no build do SCSS/Tailwind:', err);
    }
}
buildCSS();

if (isWatchMode) {
    console.log('👀 Observando mudanças nos arquivos (Chokidar)...');
    const watcher = chokidar.watch(['src/scss/**/*', 'index.html', 'tailwind.config.js'], {
        persistent: true,
        ignoreInitial: true
    });

    watcher.on('all', (event, filename) => {
        if (filename && (filename.endsWith('.scss') || filename.endsWith('.html') || filename.endsWith('.js'))) {
            console.log(`🔄 Arquivo modificado (${event}): ${filename}. Recompilando CSS...`);
            buildCSS();
        }
    });
}

// 3. Otimização de Imagens (Sharp)
async function optimizeImages() {
    const srcDir = path.join(__dirname, 'src/img');
    const destDir = path.join(__dirname, 'assets/img');

    if (!fs.existsSync(srcDir)) {
        console.warn('⚠️ Diretório src/img não encontrado, ignorando Otimização de Imagens.');
        return;
    }

    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const files = fs.readdirSync(srcDir);
    for (const file of files) {
        const srcPath = path.join(srcDir, file);
        const destPath = path.join(destDir, file);

        try {
            // Se for arquivo (prevenir travamento com pastas)
            if (fs.lstatSync(srcPath).isFile()) {
                if (file.match(/\.(png|jpe?g|webp)$/i)) {
                    // Converte forçosamente a extensão de saída para .webp
                    const webpFile = file.replace(/\.(png|jpe?g)$/i, '.webp');
                    const webpDestPath = path.join(destDir, webpFile);

                    await sharp(srcPath)
                        .webp({ quality: 80, effort: 6 })
                        .toFile(webpDestPath);
                    console.log(`✅ Imagem convertida e otimizada (WebP): ${webpFile}`);
                } else {
                    // SVG, ICO ou outros arquivos que não necessitam de conversão
                    fs.copyFileSync(srcPath, destPath);
                    console.log(`✅ Imagem copiada integralmente: ${file}`);
                }
            }
        } catch (err) {
            console.error(`❌ Erro ao processar arquivo ${file}:`, err.message);
        }
    }
}

optimizeImages();
