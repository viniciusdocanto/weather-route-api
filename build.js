const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const sass = require('sass');
const sharp = require('sharp');
// Tenta carregar do arquivo local .env (Desenvolvimento)
if (fs.existsSync(path.join(__dirname, '.env'))) {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
} else {
    require('dotenv').config();
}

// Tentativa 1: Verifica se estamos num servidor de Produção (ex: Render) e tem variáveis de ambiente injetadas no SO central.
// (Render usa NODE_ENV = 'production' por padrão)
const isProd = process.env.NODE_ENV === 'production';

// Se API_BASE_URL nao for carregado do .env/Secret, forçamos o valor correto dependendo do ambiente
let API_BASE = process.env.API_BASE_URL;

if (!API_BASE) {
    API_BASE = isProd
        ? 'https://weather-route-api.onrender.com/api' // Servidor na Nuvem
        : 'http://localhost:3000/api';                 // Servidor Local Dev
}

// Pega a versão real do package.json para injetar sem precisar de fecth na API
const APP_VERSION = require('./package.json').version;

console.log('🚧 Iniciando Build do Frontend...');
console.log(`🏷️  Injetando APP_VERSION: ${APP_VERSION}`);

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
                // Apenas a versão; API_URL é resolvida em runtime (api.js)
                'process.env.APP_VERSION': JSON.stringify(APP_VERSION)
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

    } catch (err) {
        console.error('❌ Erro no build do SCSS/Tailwind:', err);
    }
}
buildCSS();

if (isWatchMode) {
    console.log('👀 Observando mudanças nos arquivos SCSS e Tailwind...');
    // Observa Tailwind config e arquivos HTML também, pois afetam o CSS gerado
    const watchPaths = ['src/scss', 'index.html', 'tailwind.config.js'];
    watchPaths.forEach(watchPath => {
        if (fs.existsSync(watchPath)) {
            fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
                if (filename && (filename.endsWith('.scss') || filename.endsWith('.html') || filename.endsWith('.js'))) {
                    console.log(`🔄 Arquivo modificado: ${filename}. Recompilando CSS...`);
                    buildCSS();
                }
            });
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
