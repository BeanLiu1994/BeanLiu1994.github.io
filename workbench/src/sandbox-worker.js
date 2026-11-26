import * as esbuild from 'esbuild-wasm/esm/browser.js';
import compilerWasm from 'esbuild-wasm/esbuild.wasm?url';
import {newQuickJSWASMModule, RELEASE_SYNC} from 'quickjs-emscripten';

let compiler;
const extensions = ['', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.json', '/index.js', '/index.ts'];

function normalize(base, relative) {
    const parts = relative.startsWith('/') ? [] : base.split('/').slice(0, -1);
    for (const part of relative.split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') {
            if (!parts.length) return '';
            parts.pop();
        } else parts.push(part);
    }
    return parts.join('/');
}

async function bundle(files, entry, inline) {
    compiler ??= esbuild.initialize({wasmURL: compilerWasm, worker: false});
    await compiler;
    const virtual = {...files, ...(inline == null ? {} : {[entry]: inline})};
    const result = await esbuild.build({
        entryPoints: [entry], bundle: true, write: false, logLevel: 'silent',
        platform: 'browser', format: 'iife', target: 'es2022', legalComments: 'none',
        plugins: [{
            name: 'browser-workspace',
            setup(build) {
                build.onResolve({filter: /.*/}, args => {
                    const allowed = args.kind === 'entry-point' || /^(?:\.\.?\/|\/)/.test(args.path);
                    const path = args.kind === 'entry-point' ? args.path : normalize(args.importer, args.path);
                    const found = path && allowed && extensions.map(ext => path + ext).find(file => Object.hasOwn(virtual, file));
                    return found ? {path: found, namespace: 'project'} :
                        {errors: [{text: '找不到本地模块 ' + args.path + '。工作区只解析项目内的相对路径。'}]};
                });
                build.onLoad({filter: /.*/, namespace: 'project'}, args => {
                    const extension = args.path.split('.').pop();
                    const loader = ['ts', 'tsx', 'jsx', 'json'].includes(extension) ? extension : 'js';
                    return {contents: virtual[args.path], loader};
                });
            },
        }],
    });
    return result.outputFiles[0].text;
}

async function execute(code, file) {
    const vm = await newQuickJSWASMModule(RELEASE_SYNC);
    const runtime = vm.newRuntime();
    runtime.setMemoryLimit(32 * 1024 * 1024);
    runtime.setMaxStackSize(512 * 1024);
    const deadline = Date.now() + 3500;
    runtime.setInterruptHandler(() => Date.now() > deadline);
    const context = runtime.newContext();
    let printed = 0;
    try {
        const emit = context.newFunction('output', value => {
            if (printed++ < 250) self.postMessage({kind: 'output', text: context.getString(value).slice(0, 1800) + '\n'});
        });
        context.setProp(context.global, '__write', emit);
        emit.dispose();
        const setup = context.evalCode(`(() => {
            const write = globalThis.__write;
            delete globalThis.__write;
            const show = item => {
                if (typeof item === 'string') return item;
                try { return JSON.stringify(item) ?? String(item); } catch { return String(item); }
            };
            const log = (...items) => write(items.map(show).join(' '));
            globalThis.console = Object.freeze({log, info:log, warn:log, error:log, debug:log, assert(ok,...rest) {
                if (!ok) throw Error(rest.join(' ') || 'Assertion failed');
            }});
        })()`);
        context.unwrapResult(setup).dispose();
        const result = context.evalCode(code, file);
        context.unwrapResult(result).dispose();
        context.unwrapResult(runtime.executePendingJobs());
    } finally {
        context.dispose();
        runtime.dispose();
    }
}

self.onmessage = async ({data}) => {
    try {
        if (data.kind === 'preview') {
            const scripts = [];
            for (const {entry, inline} of data.scripts) scripts.push(await bundle(data.files, entry, inline));
            self.postMessage({kind: 'complete', scripts});
        } else {
            for (const file of data.entries) {
                if (data.entries.length > 1) self.postMessage({kind: 'output', text: '› ' + file + '\n'});
                await execute(await bundle(data.files, file), file);
            }
            self.postMessage({kind: 'complete', code: 0});
        }
    } catch (error) {
        self.postMessage({kind: 'error', message: String(error?.message || error).slice(0, 2200)});
    }
};
