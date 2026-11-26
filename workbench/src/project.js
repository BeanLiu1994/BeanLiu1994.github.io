import {strFromU8, strToU8, unzip, zip} from 'fflate';

const storageKey = 'bean.workbench.projects.v1';
const maxFiles = 100;
const maxFileBytes = 256 * 1024;
const maxProjectBytes = 2 * 1024 * 1024;
const ignored = new Set(['node_modules', '.git', '.next', '.cache', 'dist', 'coverage', '__MACOSX']);
const privateParts = new Set(['.npmrc', '.pypirc', '.netrc', '.ssh', '.aws', '.git-credentials', '__proto__', 'prototype', 'constructor']);

const starter = {
    'index.html': `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="style.css">
<title>浏览器工作区</title>
<main>
  <p>BEAN WORKBENCH</p>
  <h1>你好，工作区。</h1>
  <p>这里运行的是当前项目的 index.html。</p>
  <button id="action">点我试试</button>
</main>
<script src="app.js" type="module"></script>
</html>
`,
    'style.css': `body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f9f0e6;color:#2a2928;font:16px/1.6 system-ui}
main{width:min(80vw,28rem);padding:2rem 0}
h1{font-size:clamp(2.4rem,8vw,4rem);line-height:1.15;letter-spacing:-.05em;margin:.2em 0}
button{font:inherit;background:#9d4633;color:white;border:0;padding:.55em 1em;border-radius:.45em;cursor:pointer}
`,
    'app.js': `import {next} from './counter.js';\n\nconst action = document.querySelector('#action');
let clicks = 0;
action.addEventListener('click', () => {
  clicks = next(clicks);
  action.textContent = \`已点击 \${clicks} 次\`;
});
console.log('浏览器工作区已就绪');
`,
    'counter.js': 'export const next = count => count + 1;\n',
    'counter.test.js': `import {next} from './counter.js';
console.assert(next(0) === 1, 'The counter should advance by one');
console.log('PASS counter');
`,
};

export function validPath(path) {
    if (typeof path !== 'string' || path.length > 200 || !/^[\p{L}\p{N}._@ -]+(?:\/[\p{L}\p{N}._@ -]+)*$/u.test(path)) return false;
    return path.split('/').every(part => part.trim() === part && part !== '.' && part !== '..' && !ignored.has(part) &&
        !privateParts.has(part) && !(part.startsWith('.env') && !['.env.example', '.env.sample'].includes(part)) &&
        !/\.(?:pem|key|p12|pfx)$/i.test(part));
}

export function usableFiles(files) {
    const paths = Object.keys(files).sort();
    const directories = new Set(paths.flatMap(path => {
        const parts = path.split('/');
        return parts.slice(1).map((_, index) => parts.slice(0, index + 1).join('/'));
    }));
    return paths.length <= maxFiles && paths.every(path => validPath(path) && !directories.has(path) &&
        typeof files[path] === 'string' && strToU8(files[path]).length <= maxFileBytes) &&
        Object.values(files).reduce((sum, file) => sum + strToU8(file).length, 0) <= maxProjectBytes;
}

export function newProject(withStarter = false) {
    return {
        id: crypto.randomUUID(), title: '新任务', files: withStarter ? {...starter} : {},
        selected: withStarter ? 'index.html' : '', messages: [],
    };
}

export function loadWorkspace() {
    try {
        const data = JSON.parse(localStorage.getItem(storageKey));
        if (Array.isArray(data?.projects) && data.projects.length && data.projects.every(project =>
            typeof project.id === 'string' && typeof project.title === 'string' &&
            project.files && usableFiles(project.files) && Array.isArray(project.messages))) return data;
    } catch {
        // Old or unavailable storage should still allow a fresh local project.
    }
    const initial = newProject(true);
    return {selected: initial.id, projects: [initial]};
}

export function saveWorkspace(workspace) {
    localStorage.setItem(storageKey, JSON.stringify(workspace));
}

export function contextFiles(files, selected) {
    let remaining = 18000;
    const paths = Object.keys(files).sort((a, b) => Number(b === selected) - Number(a === selected) || a.localeCompare(b));
    return paths.map(path => {
        const content = files[path].slice(0, Math.min(remaining, 11000));
        remaining -= content.length;
        return {path, content, truncated: content.length < files[path].length};
    });
}

export function contextMessages(messages) {
    let remaining = 26000;
    const chosen = [];
    for (const message of messages.slice(-25).reverse()) {
        if (message.state === 'failed' || !message.text) continue;
        const content = message.text.slice(0, 16000);
        if (remaining < content.length) break;
        remaining -= content.length;
        chosen.unshift({role: message.role, content});
    }
    return chosen;
}

function checkedChanges(changes) {
    if (!Array.isArray(changes) || changes.length < 1 || changes.length > 24 ||
        changes.some(change => !change || !validPath(change.path) ||
            !(typeof change.content === 'string' && change.delete === undefined || change.delete === true && change.content === undefined)) ||
        new Set(changes.map(change => change.path)).size !== changes.length) return undefined;
    return changes;
}

export function parseAnswer(raw, toolChanges) {
    const text = raw.replace(/<think\b[^>]*>[\s\S]*?(?:<\/think>|$)/gi, '')
        .replace(/<tool_call>\s*<\/think>|<\/?think>/gi, '');
    const blocks = [...text.matchAll(/^```workspace[^\S\r\n]*\r?\n([\s\S]*?)\r?\n```[ \t]*$|<tool_call>\s*(\S[\s\S]*?)\s*<\/tool_call>/gmi)];
    const clean = text.replace(/^```workspace[^\S\r\n]*\r?\n[\s\S]*?(?:\r?\n```[ \t]*$|$(?![\s\S]))|<tool_call>[\s\S]*?(?:<\/tool_call>|$(?![\s\S]))/gmi, '').trim();
    if (toolChanges) {
        const changes = checkedChanges(toolChanges);
        return {text: clean, changes, patchError: !changes};
    }
    if (!blocks.length) return {text: clean, patchError: clean !== text.trim()};
    try {
        const proposal = blocks.flatMap(block => {
            const value = JSON.parse(block[1] || block[2]);
            if (Array.isArray(value)) return value;
            if (value.name === 'propose_workspace_changes') return value.arguments?.changes || [];
            return value.changes || [value];
        });
        const changes = checkedChanges(proposal);
        return {text: clean, changes, patchError: !changes};
    } catch {
        return {text: clean, patchError: true};
    }
}

export function fileTree(files) {
    const tree = new Map();
    for (const path of Object.keys(files).sort((left, right) => left.localeCompare(right))) {
        let parent = tree;
        const parts = path.split('/');
        for (const [index, part] of parts.entries()) {
            if (!parent.has(part)) {
                parent.set(part, index === parts.length - 1 ? {path} : {children: new Map()});
            }
            parent = parent.get(part).children;
        }
    }
    return tree;
}

export async function importFiles(inputFiles) {
    const result = Object.create(null);
    for (const file of inputFiles) {
        if (file.name.toLowerCase().endsWith('.zip')) {
            if (file.size > maxProjectBytes) throw Error('ZIP 文件超过 2 MB。');
            let total = 0;
            let count = 0;
            const bytes = new Uint8Array(await file.arrayBuffer());
            const unpacked = await new Promise((resolve, reject) => unzip(bytes, {
                filter(entry) {
                    if (!validPath(entry.name) || entry.name.endsWith('/')) return false;
                    count++;
                    total += entry.originalSize;
                    return count <= maxFiles && total <= maxProjectBytes && entry.originalSize <= maxFileBytes;
                },
            }, (error, entries) => error ? reject(error) : resolve(entries)));
            if (count > maxFiles || total > maxProjectBytes) throw Error('ZIP 内文件太多或解压后超过 2 MB。');
            for (const [name, data] of Object.entries(unpacked)) {
                if (!data.includes(0)) result[name] = strFromU8(data);
            }
        } else if (validPath(file.name) && file.size <= maxFileBytes) {
            const bytes = new Uint8Array(await file.arrayBuffer());
            if (!bytes.includes(0)) result[file.name] = strFromU8(bytes);
        }
    }
    if (!Object.keys(result).length) throw Error('没有找到可导入的文本代码文件。');
    return result;
}

export async function downloadProject(files) {
    const bytes = await new Promise((resolve, reject) => zip(Object.fromEntries(
        Object.entries(files).map(([name, text]) => [name, strToU8(text)])
    ), (error, data) => error ? reject(error) : resolve(data)));
    const url = URL.createObjectURL(new Blob([bytes], {type: 'application/zip'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bean-workspace.zip';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}
