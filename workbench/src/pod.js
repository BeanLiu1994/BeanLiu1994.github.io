let previewWorker;
let commandWorker;

function runSandbox(kind, payload, onOutput) {
    const worker = new Worker(new URL('./sandbox-worker.js', import.meta.url), {type: 'module'});
    if (kind === 'preview') previewWorker = worker;
    else commandWorker = worker;
    return new Promise((resolve, reject) => {
        function finish(error, value) {
            clearTimeout(timeout);
            worker.terminate();
            if (previewWorker === worker) previewWorker = undefined;
            if (commandWorker === worker) commandWorker = undefined;
            if (error) reject(error);
            else resolve(value);
        }
        const timeout = setTimeout(() => finish(Error('沙盒运行超时。')), 30000);
        worker.onmessage = ({data}) => {
            if (data.kind === 'output') onOutput(data.text);
            else if (data.kind === 'error') finish(Error(data.message));
            else finish(undefined, data);
        };
        worker.onerror = () => finish(Error('无法加载浏览器沙盒。'));
        worker.cancel = () => finish(Error('已停止进程。'));
        worker.postMessage({kind, ...payload});
    });
}

export async function startPreview(files) {
    const {preparePreview} = await import('./preview.js');
    const preview = preparePreview(files);
    const built = preview.scripts.length ? await runSandbox('preview', {files, scripts: preview.scripts}) : {scripts: []};
    return preview.finish(built.scripts);
}

function commandParts(line) {
    const parts = [...line.matchAll(/"([^"]*)"|'([^']*)'|([^\s"']+)/g)];
    return parts.map(part => part[1] ?? part[2] ?? part[3]);
}

export async function runCommand(line, files, onOutput) {
    const [name, path] = commandParts(line);
    if (name === 'help') {
        onOutput('help             显示可用命令\nls [目录]        列出项目文件\ncat <文件>        显示文件内容\njs <文件>         运行 JavaScript 或 TypeScript\ntest             运行项目里的 *.test.js / *.test.ts\n');
        return 0;
    }
    if (name === 'ls') {
        const prefix = path ? path.replace(/\/$/, '') + '/' : '';
        onOutput(Object.keys(files).filter(file => file.startsWith(prefix)).sort().join('\n') + '\n');
        return 0;
    }
    if (name === 'cat') {
        if (!Object.hasOwn(files, path)) throw Error('找不到文件。');
        onOutput(files[path] + '\n');
        return 0;
    }
    if (name !== 'js' && name !== 'test') throw Error('此浏览器沙盒不支持该命令。输入 help 查看可用命令。');
    const entries = name === 'test' ? Object.keys(files).filter(file => /\.test\.[jt]s$/.test(file)).sort() : [path];
    if (!entries.length) throw Error('没有找到 *.test.js 或 *.test.ts。');
    if (entries.some(file => !Object.hasOwn(files, file) || !/\.(?:[cm]?js|ts)$/.test(file))) {
        throw Error('请指定项目中的 JavaScript 或 TypeScript 文件。');
    }
    return (await runSandbox('command', {files, entries}, onOutput)).code;
}

export function stopCommand() {
    commandWorker?.cancel();
}

export function stopPreview() {
    previewWorker?.cancel();
}

export function resetPod() {
    stopPreview();
    stopCommand();
}
