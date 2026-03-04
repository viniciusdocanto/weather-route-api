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

// 2. Build do SCSS
try {
    if (!fs.existsSync('src/scss/style.scss')) {
        console.warn('⚠️ scss não encontrado, ignorando sass build');
    } else {
        const result = sass.compile('src/scss/style.scss', { style: 'compressed' });
        if (!fs.existsSync('assets/css')) fs.mkdirSync('assets/css', { recursive: true });
        fs.writeFileSync('assets/css/style.min.css', result.css);
        console.log('✅ Compilação e minificação do SCSS concluída!');
    }
} catch (err) {
    console.error('❌ Erro no build do SCSS:', err.message);
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
                    await sharp(srcPath)
                        .png({ quality: 80, compressionLevel: 8 }) // Qualidade PNG com compressão lenta e eficiente
                        .jpeg({ quality: 80, progressive: true }) // Carregamento progressivo para JPEG
                        .webp({ quality: 80 })
                        .toFile(destPath);
                    console.log(`✅ Imagem otimizada: ${file}`);
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
