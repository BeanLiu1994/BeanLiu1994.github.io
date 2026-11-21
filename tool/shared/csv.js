(() => {
    function parse(source) {
        const input = source.replace(/^\uFEFF/, "");
        const rows = [];
        let row = [];
        let value = "";
        let quoted = false;
        let closed = false;
        let started = false;

        function field() {
            row.push(value);
            value = "";
            closed = false;
            started = false;
        }

        for (let i = 0; i < input.length; i++) {
            const character = input[i];
            if (quoted) {
                if (character !== '"') value += character;
                else if (input[i + 1] === '"') { value += '"'; i++; }
                else { quoted = false; closed = true; }
                continue;
            }
            if (character === ",") {
                field();
            } else if (character === "\r" || character === "\n") {
                field();
                rows.push(row);
                row = [];
                if (character === "\r" && input[i + 1] === "\n") i++;
            } else {
                if (closed || (character === '"' && started)) {
                    throw new Error("第 " + (rows.length + 1) + " 条记录的引号格式无效");
                }
                started = true;
                if (character === '"') quoted = true;
                else value += character;
            }
        }
        if (quoted) throw new Error("CSV 包含未闭合的引号");
        if (started || row.length) {
            field();
            rows.push(row);
        }
        return rows;
    }

    function validateRows(rows) {
        if (!rows.length || !rows[0].length) throw new Error("需要一行表头");
        const width = rows[0].length;
        rows.forEach((row, index) => {
            if (row.length !== width) {
                throw new Error("第 " + (index + 1) + " 条记录有 " + row.length + " 列，应有 " + width + " 列");
            }
        });
    }

    function write(rows) {
        return rows.map(row => row.map(value => {
            const text = value == null ? "" : String(value);
            return /[",\r\n]/.test(text) || text === "" || /^\s|\s$/.test(text)
                ? '"' + text.replaceAll('"', '""') + '"'
                : text;
        }).join(",")).join("\n");
    }

    window.Csv = { parse, validateRows, write };
})();
