import CodeMirror from '@uiw/react-codemirror';
import {css} from '@codemirror/lang-css';
import {html} from '@codemirror/lang-html';
import {javascript} from '@codemirror/lang-javascript';

const languages = {
    css: [css()],
    html: [html()],
    htm: [html()],
    js: [javascript()],
    cjs: [javascript()],
    mjs: [javascript()],
    jsx: [javascript({jsx: true})],
    ts: [javascript({typescript: true})],
    tsx: [javascript({typescript: true, jsx: true})],
    json: [javascript()],
};
const options = {foldGutter: true, highlightActiveLine: true, indentOnInput: true, tabSize: 2};
const plain = [];

export default function Editor({path, value, onChange}) {
    return <CodeMirror aria-label={'编辑 ' + path} className="code-editor" value={value}
        height="100%" theme="dark" basicSetup={options}
        extensions={languages[path.split('.').pop()] || plain} onChange={onChange}/>;
}
