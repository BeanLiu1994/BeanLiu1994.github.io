(() => {
    const stage = document.querySelector(".game-page > :is(.container, .shell, .app)");
    const field = stage?.querySelector(":scope > :is(.board-wrap, .play-area, .main)");
    if (!field) return;

    const board = field.matches(".board-wrap") ? field : field.querySelector(".board-wrap");
    if (!board) return;

    const canvas = board.querySelector("canvas");
    const game = document.body.dataset.game;
    const wordle = document.body.dataset.layout === "wordle";
    const hangman = game === "hangman";
    const fluidRatio = wordle ? 5 / 6 : 0;
    const wide = matchMedia("(min-width: 650px) and (max-height: 780px)");
    const chrome = [...stage.children].filter(element => element !== field && !element.matches("script, style"));
    const controls = ".pad, .keyboard, .keypad, #numpad";

    stage.style.setProperty("--fit-rows", chrome.length || 1);
    stage.classList.add("fit-stage");
    field.classList.add("fit-field");
    board.classList.add("fit-board");
    if (canvas && !fluidRatio && !hangman) canvas.classList.add("fit-canvas");

    let frame = 0;
    let notifying = false;

    function fit() {
        frame = 0;
        if (hangman) return;
        const currentWidth = board.getBoundingClientRect().width;
        const ratio = fluidRatio || (canvas ? canvas.width / canvas.height : 1);
        if (!Number.isFinite(ratio) || ratio <= 0) return;

        const viewport = window.visualViewport;
        const viewportHeight = viewport?.scale === 1 ? viewport.height : window.innerHeight;
        const {top, bottom} = field.getBoundingClientRect();
        const controlsBelow = wide.matches ? 0 : Math.max(0, ...chrome
            .filter(element => element.matches(controls) && element.getClientRects().length)
            .map(element => element.getBoundingClientRect().bottom - bottom));
        const boardStyle = getComputedStyle(board);
        const frameHeight = parseFloat(boardStyle.paddingTop) + parseFloat(boardStyle.paddingBottom)
            + parseFloat(boardStyle.borderTopWidth) + parseFloat(boardStyle.borderBottomWidth);
        const frameWidth = parseFloat(boardStyle.paddingLeft) + parseFloat(boardStyle.paddingRight)
            + parseFloat(boardStyle.borderLeftWidth) + parseFloat(boardStyle.borderRightWidth);
        const room = viewportHeight - (top + window.scrollY) - controlsBelow - frameHeight - 8;

        // Leave the board large enough to use if the visible viewport is very short.
        const minWidth = wide.matches ? 136 : 174;
        const limit = Math.max(minWidth, Math.floor(room * ratio) + frameWidth);
        board.style.setProperty("--fit-board-width", limit + "px");

        if (Math.abs(board.getBoundingClientRect().width - currentWidth) >= 1) {
            // Existing games draw into their backing canvas on resize.
            notifying = true;
            window.dispatchEvent(new Event("resize"));
            notifying = false;
        }
    }

    function schedule() {
        if (!frame && !notifying) frame = requestAnimationFrame(fit);
    }

    // Observe controls whose labels or wrapping can change during play.
    const observer = new ResizeObserver(schedule);
    for (const element of chrome) observer.observe(element);
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    document.fonts.ready.then(schedule);
    fit();
})();
