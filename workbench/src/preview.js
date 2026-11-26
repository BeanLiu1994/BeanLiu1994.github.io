import {parse, serialize, defaultTreeAdapter as tree} from 'parse5';

const htmlSpace = 'http://www.w3.org/1999/xhtml';
const scriptType = /^(?:module|(?:application|text)\/(?:javascript|ecmascript))$/i;
const restrictions = "default-src 'none'; script-src 'unsafe-inline' data:; style-src 'unsafe-inline'; img-src data:; font-src data:; form-action 'none'; base-uri 'none'; object-src 'none'";

function attr(node, name) {
    return node.attrs?.find(item => item.name === name)?.value;
}

function makeElement(name, attrs = []) {
    return tree.createElement(name, htmlSpace, attrs.map(([name, value]) => ({name, value})));
}

function localPath(src) {
    if (!src || /^(?:\/\/|[a-z][a-z\d+.-]*:)/i.test(src)) return '';
    try {
        return decodeURIComponent(src.split(/[?#]/, 1)[0]).replace(/^(?:\.\/|\/)/, '');
    } catch {
        return '';
    }
}

function* descendants(parent) {
    for (const child of [...(parent.childNodes || [])]) {
        yield child;
        yield* descendants(child);
    }
}

export function preparePreview(files) {
    if (!Object.hasOwn(files, 'index.html')) throw Error('项目根目录需要有一个 index.html。');
    const doc = parse(files['index.html'], {scriptingEnabled: true});
    const body = [...descendants(doc)].find(node => node.tagName === 'body');
    const head = [...descendants(doc)].find(node => node.tagName === 'head');
    const scripts = [];
    const targets = [];

    for (const node of descendants(doc)) {
        if (node.tagName === 'base' || (node.tagName === 'meta' && attr(node, 'http-equiv'))) tree.detachNode(node);
        if (node.tagName === 'link' && attr(node, 'rel')?.toLowerCase() === 'stylesheet') {
            const path = localPath(attr(node, 'href'));
            if (!path || !Object.hasOwn(files, path)) throw Error('预览找不到样式文件 ' + attr(node, 'href') + '。');
            const style = makeElement('style', attr(node, 'media') ? [['media', attr(node, 'media')]] : []);
            tree.insertText(style, files[path].replace(/<\/style/gi, '<\\/style'));
            tree.insertBefore(node.parentNode, style, node);
            tree.detachNode(node);
        }
        if (node.tagName !== 'script') continue;
        const type = attr(node, 'type');
        if (type && !scriptType.test(type)) continue;
        const src = attr(node, 'src');
        if (src) {
            const entry = localPath(src);
            if (!entry || !Object.hasOwn(files, entry)) throw Error('预览找不到脚本文件 ' + src + '。');
            scripts.push({entry});
        } else {
            const inline = tree.getTextNodeContent(node.childNodes[0] || {});
            if (!inline) continue;
            scripts.push({entry: '__preview_inline_' + scripts.length + '.js', inline});
        }
        targets.push(node);
    }
    const meta = makeElement('meta', [['http-equiv', 'Content-Security-Policy'], ['content', restrictions]]);
    if (head.childNodes.length) tree.insertBefore(head, meta, head.childNodes[0]);
    else tree.appendChild(head, meta);
    return {scripts, finish(results) {
        targets.forEach((current, index) => {
            const script = makeElement('script', [['src', 'data:text/javascript;charset=utf-8,' + encodeURIComponent(results[index])]]);
            tree.detachNode(current);
            tree.appendChild(body, script);
        });
        return serialize(doc);
    }};
}
