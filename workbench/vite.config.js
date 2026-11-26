import {defineConfig} from 'vite';

export default defineConfig({
    base: '/workbench/',
    worker: {format: 'es'},
    esbuild: {jsx: 'automatic'},
    server: {
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp'
        }
    }
});
