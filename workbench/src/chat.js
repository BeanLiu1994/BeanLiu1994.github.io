const api = import.meta.env.BASE_URL + 'api/';

export async function fetchUsage() {
    const response = await fetch(api + 'usage');
    if (!response.ok) throw Error('暂时无法读取额度。');
    return (await response.json()).usage;
}

export async function streamAnswer(payload, signal, render) {
    const response = await fetch(api + 'chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
        signal,
    });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw Error(data.message || '请求暂时失败。');
    }
    let tail = '';
    let answer = '';
    let complete = false;
    let model = '';
    let changes;

    function readLine(line) {
        if (!line.startsWith('data:')) return;
        const data = JSON.parse(line.slice(5).trim());
        if (data.error) throw Error(data.error);
        if (Array.isArray(data.changes)) changes = data.changes;
        if (data.done) {
            complete = true;
            model = data.model || '';
        }
        if (data.text) {
            answer += data.text;
            render(answer);
        }
    }

    function readChunk(chunk) {
        tail += chunk;
        const lines = tail.split('\n');
        tail = lines.pop();
        for (const line of lines) readLine(line);
    }

    if (response.body?.getReader) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        try {
            while (true) {
                const {done, value} = await reader.read();
                if (done) break;
                readChunk(decoder.decode(value, {stream: true}));
            }
            readChunk(decoder.decode());
        } catch (error) {
            reader.cancel().catch(() => {});
            throw error;
        } finally {
            reader.releaseLock();
        }
    } else {
        readChunk(await response.text());
    }
    readLine(tail);
    if (!complete || !answer.trim() && !changes) throw Error('上游没有返回完整回答，请稍后重试。');
    return {answer: answer || '请先查看拟议的文件变更。', model, changes};
}
