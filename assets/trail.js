(() => {
    const endpoint = "https://dki.beanee.eu.org/trail-api/v1";
    const games = ["hanoi", "tictactoe", "2048"];
    const descriptions = {
        hanoi: "把所有圆盘依规则移到右边。",
        tictactoe: "执 X 落子，至少与对手打成平局。",
        "2048": "滑动方块，合出一块 128。",
    };
    const active = new URLSearchParams(location.search).get("trail") === "1";
    const playerKey = "bean.trail.player.v1";
    const stampKey = game => "bean.trail.stamp.v1." + game;

    function player() {
        let id = localStorage.getItem(playerKey);
        if (!/^[0-9a-f]{32}$/.test(id ?? "")) {
            id = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
            localStorage.setItem(playerKey, id);
        }
        return id;
    }

    function stamps() {
        return Object.fromEntries(games.map(game => [game, localStorage.getItem(stampKey(game))]));
    }

    async function request(op, data = {}) {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({op, player: player(), ...data}),
            signal: AbortSignal.timeout(9000),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "unavailable");
        return result;
    }

    function mount(game, onSetup) {
        if (!active) return null;

        document.body.classList.add("trail-round");
        for (const button of document.querySelectorAll("button[id*='auto' i]")) {
            button.disabled = true;
            button.title = "寻迹挑战需手动完成";
        }
        const panel = document.createElement("section");
        panel.className = "trail-banner";
        panel.innerHTML = `
            <div>
                <strong>寻迹挑战</strong>
                <p class="trail-instructions"></p>
                <p class="trail-status" role="status">正在准备挑战…</p>
            </div>
            <div class="trail-options">
                <button type="button" hidden>重试</button>
                <a href="../../trail/">回到线索页</a>
                <a href="./">普通游戏</a>
            </div>`;
        panel.querySelector(".trail-instructions").textContent = descriptions[game];
        const stage = document.querySelector(".game-page > :is(.container, .shell, .app)");
        const actionRow = stage.querySelector(":scope > .detail-game-actions");
        stage.insertBefore(panel, actionRow || stage.firstElementChild);
        const status = panel.querySelector(".trail-status");
        const retry = panel.querySelector("button");
        let ticket = "";
        let pending = false;
        let earned = false;

        async function prepare() {
            status.textContent = "正在准备挑战…";
            retry.hidden = true;
            try {
                const round = await request("round", {game});
                ticket = round.ticket;
                earned = false;
                onSetup(round.setup);
                status.textContent = "这一轮只记录你的手动操作。";
            } catch {
                ticket = "";
                status.textContent = "暂时无法开始挑战，请重试。";
                retry.onclick = prepare;
                retry.hidden = false;
            }
        }

        async function complete(actions) {
            if (!ticket || pending || earned) return;
            pending = true;
            retry.hidden = true;
            status.textContent = "正在核验这一轮…";
            try {
                const {stamp} = await request("award", {game, ticket, actions});
                localStorage.setItem(stampKey(game), stamp);
                earned = true;
                status.textContent = "找到一枚印记。回到线索页查看。";
                panel.classList.add("trail-earned");
            } catch (error) {
                if (error.message === "expired_round" || error.message === "invalid_round") {
                    status.textContent = error.message === "expired_round" ? "挑战已过期，请开启新一轮。" : "这一轮未通过核验，请开启新一轮。";
                    retry.textContent = "新一轮";
                    retry.onclick = prepare;
                } else {
                    status.textContent = "暂时无法核验，这一轮可以重试提交。";
                    retry.textContent = "重试提交";
                    retry.onclick = () => complete(actions);
                }
                retry.hidden = false;
            } finally {
                pending = false;
            }
        }

        prepare();
        return {get ready() { return Boolean(ticket); }, complete};
    }

    function hub() {
        const cards = [...document.querySelectorAll("[data-trail-game]")];
        const form = document.getElementById("trail-lock");
        const status = document.getElementById("trail-hub-status");
        const refresh = document.getElementById("trail-refresh");

        async function showState() {
            refresh.disabled = true;
            try {
                const {clues} = await request("state", {stamps: stamps()});
                for (const card of cards) {
                    const clue = clues[card.dataset.trailGame];
                    card.classList.toggle("earned", Boolean(clue));
                    card.querySelector(".trail-clue").textContent = clue || "尚未找到";
                }
                const count = Object.keys(clues).length;
                status.textContent = count + " / 3 枚印记";
                form.hidden = count !== games.length;
            } catch {
                status.textContent = "暂时无法读取线索，请重试。";
            } finally {
                refresh.disabled = false;
            }
        }

        refresh.addEventListener("click", showState);
        addEventListener("storage", event => {
            if (games.some(game => event.key === stampKey(game))) showState();
        });
        addEventListener("pageshow", showState);
        form.addEventListener("submit", async event => {
            event.preventDefault();
            const input = form.querySelector("input");
            const submit = form.querySelector("button");
            const feedback = document.getElementById("trail-lock-status");
            submit.disabled = true;
            try {
                const {ending} = await request("finish", {stamps: stamps(), code: input.value});
                const reveal = document.getElementById("trail-ending");
                reveal.querySelector("p").textContent = ending;
                reveal.hidden = false;
                form.hidden = true;
                reveal.focus();
            } catch (error) {
                feedback.textContent = error.message === "wrong_code" ? "还差一点。按线索编号排列三个数字。" : "暂时无法打开，请重试。";
            } finally {
                submit.disabled = false;
            }
        });
    }

    window.Trail = {active, mount};
    if (document.getElementById("trail-hub")) hub();
})();
