import {lazy, Suspense, useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {
    ArrowUp, Check, ChevronDown, ChevronRight, CodeXml, Download, FileCode2, FilePlus,
    Files, GitCompareArrows, Globe, Menu, Play, Plus, Square, Terminal, Trash2, Upload, X,
} from 'lucide-react';
import {diffLines} from 'diff';
import {fetchUsage, streamAnswer} from './chat.js';
import {resetPod, runCommand, startPreview, stopCommand, stopPreview} from './pod.js';
import {
    contextFiles, contextMessages, downloadProject, fileTree, importFiles, loadWorkspace,
    newProject, parseAnswer, saveWorkspace, usableFiles, validPath,
} from './project.js';
import './style.css';

const Editor = lazy(() => import('./editor.jsx'));
const starterPrompts = ['看看这个项目是怎么运行的', '把示例页面改成一个计数器'];
const resetClock = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function Tree({tree, active, onSelect}) {
    return <ul className="tree">{[...tree].map(([name, item]) => (
        <li key={name}>
            {item.children ? <details open>
                <summary><ChevronRight size={13}/>{name}</summary>
                <Tree tree={item.children} active={active} onSelect={onSelect}/>
            </details> : <button type="button" className={active === item.path ? 'selected' : ''}
                onClick={() => onSelect(item.path)} title={item.path}>
                <FileCode2 size={14}/><span>{name}</span>
            </button>}
        </li>
    ))}</ul>;
}

function Quota({usage}) {
    const entries = [['最近 5 小时', usage?.fiveHour], ['本周', usage?.week]];
    return <details className="quota">
        <summary>共享额度 <ChevronDown size={13}/></summary>
        <div className="quota-popover">
            {entries.map(([label, period]) => <div className="quota-row" key={label}>
                <div><strong>{label}</strong>{period && <span>{period.used} / {period.limit}</span>}</div>
                {period && <progress max={period.limit} value={period.used} aria-label={label}/>}
                <small>{period?.refreshAt ? '下次恢复 ' + resetClock.format(period.refreshAt) : period ? '额度可用' : '暂时无法读取'}</small>
            </div>)}
            <small>北京时间 · 对所有访客共享</small>
        </div>
    </details>;
}

function Review({proposal, files, onApply}) {
    const [selected, select] = useState(0);
    const change = proposal?.changes?.[selected];
    if (!change) return <p className="console-empty">模型提出的文件修改会显示在这里。</p>;
    const path = change.path;
    const before = files[path] || '';
    const after = change.delete ? '' : change.content;
    const diff = diffLines(before, after, {timeout: 500});
    const conflict = proposal.changes.some(item => (files[item.path] ?? null) !== item.original);
    return <div className="review">
        <div className="review-bar">
            <select aria-label="查看文件改动" value={selected} onChange={event => select(Number(event.target.value))}>
                {proposal.changes.map((item, index) => <option key={item.path} value={index}>{item.path}</option>)}
            </select>
            <button className="accent" type="button" onClick={() => onApply(proposal)} disabled={proposal.applied || conflict}>
                <Check size={15}/>{proposal.applied ? '已应用' : '应用变更'}
            </button>
        </div>
        {!proposal.applied && conflict && <p className="conflict">原文件已经改动，请让模型基于当前文件重新生成。</p>}
        <pre className="diff" aria-label="文件差异">
            {diff ? diff.map((part, index) => <code key={index} className={part.added ? 'added' : part.removed ? 'removed' : ''}>
                {part.value.replace(/\n$/, '').split('\n').map(line => (part.added ? '+ ' : part.removed ? '− ' : '  ') + line).join('\n') + '\n'}
            </code>) : '文件差异较大，请查看编辑器。'}
        </pre>
    </div>;
}

function App() {
    const [workspace, setWorkspace] = useState(loadWorkspace);
    const [draft, setDraft] = useState('');
    const [usage, setUsage] = useState();
    const [busy, setBusy] = useState(false);
    const [sidebar, setSidebar] = useState(false);
    const [mobile, setMobile] = useState('chat');
    const [tab, setTab] = useState('files');
    const [proposalId, setProposalId] = useState('');
    const [logs, setLogs] = useState('');
    const [command, setCommand] = useState('');
    const [running, setRunning] = useState(false);
    const [preview, setPreview] = useState('');
    const [starting, setStarting] = useState(false);
    const [note, setNote] = useState('');
    const [fileName, setFileName] = useState(null);
    const [outputForChat, setOutputForChat] = useState(false);
    const abort = useRef(null);
    const picker = useRef(null);
    const endOfChat = useRef(null);
    const output = useRef(null);
    const runtimeGeneration = useRef(0);
    const storageError = useRef(false);
    const project = workspace.projects.find(item => item.id === workspace.selected) || workspace.projects[0];
    const paths = Object.keys(project.files);
    const selected = project.selected;
    const proposal = project.messages.find(message => message.id === proposalId);
    const isRunning = Boolean(preview || starting);

    function refreshUsage() {
        return fetchUsage().then(setUsage).catch(() => {});
    }

    useEffect(() => {
        refreshUsage();
        const refresh = setInterval(refreshUsage, 45_000);
        return () => clearInterval(refresh);
    }, []);

    useEffect(() => {
        try {
            saveWorkspace(workspace);
            storageError.current = false;
        } catch {
            if (!storageError.current) setNote('浏览器存储已满，请导出项目后整理旧任务。');
            storageError.current = true;
        }
    }, [workspace]);

    useEffect(() => { endOfChat.current?.scrollIntoView({block: 'nearest'}); }, [project.messages]);
    useEffect(() => { if (output.current) output.current.scrollTop = output.current.scrollHeight; }, [logs, tab]);

    function editProject(id, update) {
        setWorkspace(previous => ({...previous, projects: previous.projects.map(item => item.id === id ? update(item) : item)}));
    }

    function updateMessage(id, change) {
        editProject(project.id, item => ({
            ...item,
            messages: item.messages.map(message => message.id === id ? {...message, ...change} : message),
        }));
    }

    function selectProject(id) {
        if (id === project.id) return setSidebar(false);
        abort.current?.abort();
        runtimeGeneration.current++;
        resetPod();
        setWorkspace(previous => ({...previous, selected: id}));
        setSidebar(false);
        setDraft('');
        setPreview('');
        setStarting(false);
        setRunning(false);
        setLogs('');
        setNote('');
        setFileName(null);
        setOutputForChat(false);
        setTab('files');
        setMobile('chat');
    }

    function makeProject() {
        if (workspace.projects.length >= 20) return setNote('最多保留 20 个本地任务。可以先导出并删除旧任务。');
        const item = newProject(true);
        setWorkspace(previous => ({...previous, projects: [item, ...previous.projects]}));
        selectProject(item.id);
    }

    function removeProject() {
        if (!confirm('删除此任务和浏览器里的项目文件？')) return;
        const next = workspace.projects.filter(item => item.id !== project.id);
        if (!next.length) next.push(newProject(true));
        selectProject(next[0].id);
        setWorkspace(previous => ({...previous, projects: next}));
    }

    function setFiles(files, name) {
        if (!usableFiles(files)) {
            setNote('文件路径存在冲突，或超过 100 个文本文件／2 MB 项目大小上限。');
            return false;
        }
        editProject(project.id, item => ({...item, files, selected: name}));
        return true;
    }

    function addFile(event) {
        event.preventDefault();
        const path = fileName.trim();
        if (!validPath(path) || Object.hasOwn(project.files, path)) return setNote('请输入未使用的相对文件路径。');
        if (setFiles({...project.files, [path]: ''}, path)) {
            setFileName(null);
            setNote('');
        }
    }

    async function importSelection(event) {
        const picked = [...event.target.files];
        event.target.value = '';
        if (!picked.length) return;
        const id = project.id;
        try {
            const files = await importFiles(picked);
            editProject(id, item => {
                const merged = {...item.files, ...files};
                if (!usableFiles(merged)) {
                    queueMicrotask(() => setNote('导入后的项目超过大小上限，或文件路径有冲突。'));
                    return item;
                }
                return {...item, files: merged, selected: Object.keys(files)[0]};
            });
        } catch (error) {
            setNote(error.message);
        }
    }

    function apply(proposed) {
        if (proposed.applied || proposed.changes.some(change => (project.files[change.path] ?? null) !== change.original)) return;
        const files = {...project.files};
        for (const change of proposed.changes) {
            if (change.delete) delete files[change.path];
            else files[change.path] = change.content;
        }
        if (!setFiles(files, proposed.changes.find(item => !item.delete)?.path || Object.keys(files)[0] || '')) return;
        updateMessage(proposed.id, {applied: true});
        setNote('改动已应用到浏览器工作区。');
        setTab('files');
    }

    async function send(value) {
        const content = value.trim();
        if (!content || abort.current) return;
        const requestText = content + (outputForChat && logs ? '\n\n浏览器运行输出（供调试参考）：\n' + logs.slice(-4200) : '');
        const user = {id: crypto.randomUUID(), role: 'user', text: requestText, state: 'complete'};
        const assistant = {id: crypto.randomUUID(), role: 'assistant', text: '', state: 'pending'};
        const messages = [...project.messages, user];
        const controller = new AbortController();
        abort.current = controller;
        setBusy(true);
        setDraft('');
        setOutputForChat(false);
        editProject(project.id, item => ({
            ...item, title: item.messages.length ? item.title : content.slice(0, 42),
            messages: [...messages, assistant].slice(-60),
        }));
        try {
            const result = await streamAnswer({
                messages: contextMessages(messages), files: contextFiles(project.files, selected),
            }, controller.signal, text => updateMessage(assistant.id, {text: parseAnswer(text).text}));
            const answer = parseAnswer(result.answer, result.changes);
            updateMessage(assistant.id, {
                ...answer, model: result.model, state: 'complete',
                changes: answer.changes?.map(change => ({...change, original: project.files[change.path] ?? null})),
            });
        } catch (error) {
            updateMessage(user.id, {state: 'failed'});
            updateMessage(assistant.id, {state: 'failed', text: controller.signal.aborted ? '已停止生成。' : error.message});
        } finally {
            abort.current = null;
            setBusy(false);
            refreshUsage();
        }
    }

    function log(value, generation) {
        if (generation !== runtimeGeneration.current) return;
        const text = String(value).replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r(?!\n)/g, '\n');
        setLogs(previous => (previous + text).slice(-18000));
    }

    async function launch() {
        if (isRunning) {
            stopPreview();
            setPreview('');
            setStarting(false);
            return;
        }
        const generation = runtimeGeneration.current;
        setTab('preview');
        setMobile('project');
        setStarting(true);
        setNote('');
        try {
            const document = await startPreview(project.files);
            if (generation !== runtimeGeneration.current) return;
            setPreview(document);
        } catch (error) {
            if (generation === runtimeGeneration.current) setNote(error.message);
        } finally {
            if (generation === runtimeGeneration.current) setStarting(false);
        }
    }

    async function terminal(event) {
        event.preventDefault();
        if (running || !command.trim()) return;
        const line = command.trim();
        const generation = runtimeGeneration.current;
        setCommand('');
        setRunning(true);
        log('\n$ ' + line + '\n', generation);
        try {
            const code = await runCommand(line, project.files, text => log(text, generation));
            log('\n进程退出 · ' + code + '\n', generation);
        } catch (error) {
            log(error.message + '\n', generation);
        } finally {
            if (generation === runtimeGeneration.current) setRunning(false);
        }
    }

    const tabs = [['files', Files, '文件'], ['changes', GitCompareArrows, '变更'],
        ['terminal', Terminal, '终端'], ['preview', Globe, '预览']];

    return <div className="app">
        <header className="topbar">
            <div className="identity">
                <button className="icon menu" type="button" aria-label="任务列表" aria-expanded={sidebar} onClick={() => setSidebar(!sidebar)}><Menu size={20}/></button>
                <span className="brand-icon"><CodeXml size={21}/></span>
                <div><strong>代码工作台</strong><span className="brand-subtitle">Bean Workbench</span></div>
            </div>
            <div className="top-actions">
                <span className="route" title="使用本机 FreeLLMAPI 自动路由"><i/>FreeLLMAPI · Auto</span>
                <Quota usage={usage}/>
            </div>
        </header>
        <nav className="mobile-nav" aria-label="工作区视图">
            <button className={mobile === 'chat' ? 'selected' : ''} onClick={() => setMobile('chat')}>对话</button>
            <button className={mobile === 'project' ? 'selected' : ''} onClick={() => setMobile('project')}>工作区</button>
        </nav>
        <div className="layout" data-mobile={mobile}>
            <aside className={'sidebar' + (sidebar ? ' open' : '')} aria-label="本地任务">
                <button className="new-task" type="button" onClick={makeProject}><Plus size={17}/>新任务</button>
                <p className="pane-label">本地任务</p>
                <div className="task-list">{workspace.projects.map(item => <button type="button" key={item.id}
                    className={'task' + (item.id === project.id ? ' active' : '')} onClick={() => selectProject(item.id)}>{item.title}</button>)}</div>
                <div className="sidebar-footer">
                    <a href="https://me.beanee.eu.org/">个人主页</a>
                    <a href="/text/">Pastebin</a>
                </div>
            </aside>
            {sidebar && <button type="button" className="scrim" onClick={() => setSidebar(false)} aria-label="关闭任务列表"/>}
            <section className="chat" aria-label="聊天">
                <div className="pane-header"><strong>{project.title}</strong>
                    <button className="icon quiet" type="button" aria-label="删除此任务" title="删除此任务" onClick={removeProject}><Trash2 size={16}/></button>
                </div>
                <div className="transcript" aria-live="off">
                    {!project.messages.length && <div className="welcome">
                        <span className="welcome-icon"><CodeXml size={26}/></span>
                        <h1>今天想构建什么？</h1>
                        <p>对话、编辑文件，在浏览器沙盒里运行项目。</p>
                        <div className="prompts">{starterPrompts.map(prompt => <button key={prompt} type="button"
                            onClick={() => setDraft(prompt)}>{prompt}</button>)}</div>
                    </div>}
                    {project.messages.map(message => <article key={message.id} className={'message ' + message.role + (message.state === 'failed' ? ' failed' : '')}>
                        <div className="message-label">{message.role === 'user' ? '你' : '工作台'}{message.model && <small>{message.model}</small>}</div>
                        <div className="message-text">{message.text || (message.state === 'pending' ? '正在生成…' : '')}</div>
                        {message.state === 'complete' && message.patchError && <small>变更格式不完整。可以让模型把改动拆成较小的步骤。</small>}
                        {message.changes && <button className="change-link" type="button"
                            onClick={() => { setProposalId(message.id); setTab('changes'); setMobile('project'); }}>
                            <GitCompareArrows size={16}/>{message.applied ? '已应用' : '查看变更'} · {message.changes.length} 个文件
                        </button>}
                    </article>)}
                    <div ref={endOfChat}/>
                </div>
                <form className="composer" onSubmit={event => {event.preventDefault(); send(draft);}}>
                    <textarea aria-label="描述你的任务" placeholder="描述你的任务…" value={draft} maxLength={11600} rows="3"
                        onChange={event => setDraft(event.target.value)} onKeyDown={event => {
                            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                                event.preventDefault();
                                if (!busy) send(draft);
                            }
                        }}/>
                    <div className="compose-actions">
                        <label><input type="checkbox" disabled={!logs} checked={outputForChat} onChange={event => setOutputForChat(event.target.checked)}/>附上终端输出</label>
                        {busy ? <button className="accent" type="button" onClick={() => abort.current?.abort()} aria-label="停止生成"><Square size={17}/></button> :
                            <button className="accent" type="submit" disabled={!draft.trim()} aria-label="发送"><ArrowUp size={19}/></button>}
                    </div>
                </form>
                <p className="privacy">文件保存在当前浏览器。发送时，相关代码会一并提交给模型。</p>
            </section>
            <section className="project" aria-label="浏览器代码工作区">
                <div className="pane-header">
                    <div><strong>工作区</strong><span className="local-tag">浏览器沙盒</span></div>
                    <button className="run" type="button" onClick={launch} disabled={starting}>
                        {isRunning ? <Square size={15}/> : <Play size={15}/>}
                        {starting ? '启动中…' : isRunning ? '停止预览' : '运行预览'}
                    </button>
                </div>
                <nav className="tabs" aria-label="工作区工具">{tabs.map(([id, Icon, name]) => <button key={id}
                    type="button" aria-current={tab === id ? 'page' : undefined} className={tab === id ? 'active' : ''}
                    onClick={() => setTab(id)}><Icon size={16}/>{name}</button>)}</nav>
                {note && <div className="notice" role="status">{note}<button className="icon" type="button" aria-label="关闭提示" onClick={() => setNote('')}><X size={16}/></button></div>}
                {tab === 'files' && <div className="files-area">
                    <div className="file-panel">
                        <div className="file-toolbar">
                            <span>项目文件</span>
                            <div>
                                <button type="button" className="icon" title="新建文件" aria-label="新建文件" onClick={() => setFileName('')}><FilePlus size={15}/></button>
                                <button type="button" className="icon" title="导入文件或 ZIP" aria-label="导入文件或 ZIP" onClick={() => picker.current.click()}><Upload size={15}/></button>
                                <button type="button" className="icon" title="导出项目 ZIP" aria-label="导出项目 ZIP" onClick={() => downloadProject(project.files).catch(error => setNote(error.message))}><Download size={15}/></button>
                            </div>
                            <input type="file" ref={picker} hidden multiple onChange={importSelection}/>
                        </div>
                        {fileName !== null && <form className="new-file" onSubmit={addFile}>
                            <input type="text" autoFocus aria-label="文件相对路径" placeholder="src/app.js" value={fileName}
                                onChange={event => setFileName(event.target.value)} onKeyDown={event => {if (event.key === 'Escape') setFileName(null);}}/>
                            <button type="submit" className="icon" aria-label="创建文件"><Check size={14}/></button>
                        </form>}
                        {paths.length ? <Tree tree={fileTree(project.files)} onSelect={path => editProject(project.id, item => ({...item, selected: path}))} active={selected}/> :
                            <p className="empty-files">新建文件或导入项目。</p>}
                    </div>
                    <div className="editor-panel">{selected && Object.hasOwn(project.files, selected) ? <>
                        <div className="editor-title"><span><FileCode2 size={15}/>{selected}</span>
                            <button type="button" className="icon quiet" aria-label="删除当前文件" title="删除当前文件" onClick={() => {
                                if (!confirm('删除 ' + selected + '？')) return;
                                const next = {...project.files};
                                delete next[selected];
                                setFiles(next, Object.keys(next).sort()[0] || '');
                            }}><Trash2 size={15}/></button>
                        </div>
                        <Suspense fallback={<p className="console-empty">正在载入编辑器…</p>}>
                            <Editor key={project.id + selected} path={selected} value={project.files[selected]}
                                onChange={text => {
                                    if (new Blob([text]).size <= 256 * 1024) setFiles({...project.files, [selected]: text}, selected);
                                    else setNote('单个文件不能超过 256 KB。');
                                }}/>
                        </Suspense>
                    </> : <p className="console-empty">选择一个文件开始编辑。</p>}</div>
                </div>}
                {tab === 'changes' && <Review key={proposalId} proposal={proposal} files={project.files} onApply={apply}/>}
                {tab === 'terminal' && <div className="terminal-panel">
                    <pre ref={output} aria-label="终端输出">{logs || '在浏览器沙盒中运行命令。例如 test 或 js counter.test.js。输入 help 可查看全部命令。'}</pre>
                    <form className="terminal-form" onSubmit={terminal}>
                        <label htmlFor="command">$</label><input id="command" type="text" autoComplete="off" placeholder="输入命令" value={command} maxLength={500} onChange={event => setCommand(event.target.value)}/>
                        {running ? <button type="button" onClick={stopCommand} className="icon" aria-label="停止命令"><Square size={16}/></button> :
                            <button type="submit" className="icon" aria-label="运行命令" disabled={!command.trim()}><Play size={16}/></button>}
                    </form>
                </div>}
                {tab === 'preview' && <div className="preview-panel">{preview ?
                    <iframe key={preview} title="项目预览" srcDoc={preview} sandbox="allow-scripts" referrerPolicy="no-referrer"/> :
                    <p className="console-empty">{starting ? '正在启动浏览器沙盒和项目…' : '运行预览会从项目根目录加载 index.html。'}</p>}</div>}
            </section>
        </div>
    </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
