const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const sass = require('sass');
const sharp = require('sharp');
require('dotenv').config();

// Se API_BASE_URL nao for carregado do .env/Secret, forçamos o valor padrão de desenvolvimento
const API_BASE = process.env.API_BASE_URL || '/api';

// Pega a versão real do package.json para injetar sem precisar de fecth na API
const APP_VERSION = require('./package.json').version;

console.log('🚧 Iniciando Build do Frontend...');
console.log(`🔗 Injetando API_BASE: ${API_BASE}`);
console.log(`🏷️  Injetando APP_VERSION: ${APP_VERSION}`);

// 1. Build do JavaScript
esbuild.build({
    entryPoints: ['src/js/script.js'],
    bundle: true,
    minify: true,
    outfile: 'assets/js/script.min.js',
    define: {
        // Substitumos fisicamente o valor no bundle gerado usando stringify para evitar escapes ou erros sintáticos
        'process.env.API_BASE_URL': JSON.stringify(API_BASE),
        'process.env.APP_VERSION': JSON.stringify(APP_VERSION)
    }
}).then(() => {
    console.log('✅ Build do Javascript concluído com sucesso!');
}).catch((err) => {
    console.error('❌ Erro no build do JS:', err);
    process.exit(1);
});

// 2. Build do SCSS com Tailwind CSS (PostCSS)
async function buildCSS() {
    try {
        if (!fs.existsSync('src/scss/style.scss')) {
            console.warn('⚠️ scss não encontrado, ignorando sass build');
            return;
        }

        // Primeiro: Compila SCSS Nativo
        const sassResult = sass.compile('src/scss/style.scss');

        // Segundo: Passa o resultado pelo PostCSS (para Tailwind e Autoprefixer)
        const postcss = require('postcss');
        const tailwindcss = require('tailwindcss');
        const autoprefixer = require('autoprefixer');

        const postcssResult = await postcss([
            tailwindcss,
            autoprefixer
        ]).process(sassResult.css, { from: 'src/scss/style.scss', to: 'assets/css/style.min.css' });

        if (!fs.existsSync('assets/css')) fs.mkdirSync('assets/css', { recursive: true });

        // Terceiro: Minifica o CSS final usando ESBuild internamente (mais veloz que outro minifyer)
        const finalMinified = await esbuild.transform(postcssResult.css, { loader: 'css', minify: true });

        fs.writeFileSync('assets/css/style.min.css', finalMinified.code);
        console.log('✅ Compilação SCSS + Tailwind + Minificação concluída com sucesso!');

    } catch (err) {
        console.error('❌ Erro no build do SCSS/Tailwind:', err);
    }
}
buildCSS();

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
