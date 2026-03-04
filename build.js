const esbuild = require('esbuild');
const fs = require('fs');
require('dotenv').config();

// Se API_BASE_URL nao for carregado do .env/Secret, forçamos o valor padrão de desenvolvimento
const API_BASE = process.env.API_BASE_URL || '/api';

console.log('🚧 Iniciando Build do Frontend...');
console.log(`🔗 Injetando API_BASE: ${API_BASE}`);

esbuild.build({
    entryPoints: ['assets/js/script.js'],
    bundle: true,
    minify: true,
    outfile: 'assets/js/script.min.js',
    define: {
        // Substitumos fisicamente o valor no bundle gerado.
        // As aspas duplas adicionais são necessárias para o esbuild injetar como string Javascript
        'process.env.API_BASE_URL': `"${API_BASE}"`
    }
}).then(() => {
    console.log('✅ Build do Javascript concluído com sucesso!');
}).catch((err) => {
    console.error('❌ Erro no build:', err);
    process.exit(1);
});
