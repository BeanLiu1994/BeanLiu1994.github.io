(() => {
    const search = document.getElementById("search");
    const genre = document.getElementById("genre");
    const filters = [...document.querySelectorAll("[data-filter]")];
    const status = document.getElementById("catalog-status");
    const empty = document.getElementById("empty-state");
    const previewSize = 8;
    const groups = ["games", "tools"].map(id => {
        const section = document.getElementById(id);
        return {
            id,
            section,
            count: section.querySelector("[data-count]"),
            expand: section.querySelector("[data-expand]"),
            expanded: false,
            entries: [...section.querySelectorAll("li")].map(item => {
                const link = item.querySelector("a");
                return {
                    item,
                    genre: item.dataset.genre,
                    keywords: (link.textContent + " " + link.getAttribute("href")).toLowerCase(),
                };
            }),
        };
    });
    let scope = "all";

    function render() {
        const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const filterByGenre = genre.value !== "all";
        let total = 0;

        for (const group of groups) {
            let matches = 0;
            const inScope = scope === "all" || group.id === scope;

            for (const entry of group.entries) {
                const inGenre = group.id !== "games" || !filterByGenre || entry.genre === genre.value;
                const match = inScope && inGenre && words.every(word => entry.keywords.includes(word));
                if (match) matches++;
                entry.item.hidden = !match || (!group.expanded && !words.length && matches > previewSize);
            }

            group.section.hidden = matches === 0;
            group.count.textContent = matches;
            group.expand.hidden = words.length > 0 || matches <= previewSize;
            group.expand.textContent = group.expanded ? "Show fewer " + group.id : "Show all " + matches + " " + group.id;
            group.expand.setAttribute("aria-expanded", String(group.expanded));
            total += matches;
        }

        filters.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.filter === scope)));
        genre.disabled = scope === "tools";
        empty.hidden = total > 0;
        status.textContent = total ? total + (total === 1 ? " result" : " results") : "No matches found.";
    }

    function selectScope(next, clearSearch = false) {
        scope = next;
        genre.value = "all";
        if (clearSearch) search.value = "";
        render();
    }

    for (const group of groups) {
        group.expand.addEventListener("click", () => {
            group.expanded = !group.expanded;
            render();
        });
    }

    for (const button of filters) {
        button.addEventListener("click", () => selectScope(button.dataset.filter));
    }

    document.querySelectorAll("[data-jump]").forEach(link => {
        link.addEventListener("click", () => selectScope(link.dataset.jump, true));
    });

    function selectFromHash() {
        const target = location.hash.slice(1);
        if (target === "games" || target === "tools") selectScope(target, true);
    }

    window.addEventListener("hashchange", selectFromHash);
    search.addEventListener("input", render);
    genre.addEventListener("change", () => {
        if (genre.value !== "all") scope = "games";
        render();
    });

    document.getElementById("reset").addEventListener("click", () => {
        selectScope("all", true);
        search.focus();
    });

    document.getElementById("catalog-search").hidden = false;
    document.getElementById("catalog-controls").hidden = false;
    selectFromHash();
    render();
})();

(() => {
    const hero = document.querySelector(".hero");
    const stage = hero.querySelector(".hero-stage");
    const art = hero.querySelector(".hero-art");
    const content = hero.querySelector(".hero-content");
    const progress = hero.querySelector(".hero-progress span");
    const header = document.querySelector(".site-header");
    const scenePreference = matchMedia("(prefers-reduced-motion: no-preference) and (min-height: 34rem)");
    const parallax = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    const duration = 1000;
    const copyFadeEnd = .62;
    let scene;
    let frame = 0;

    function pausedAnimation(element, keyframes) {
        const animation = element.animate(keyframes, { duration, fill: "both" });
        animation.pause();
        return animation;
    }

    function renderScene() {
        frame = 0;
        if (!scene) return;

        const bounds = hero.getBoundingClientRect();
        const distance = bounds.height - stage.offsetHeight;
        const fraction = Math.max(0, Math.min(1, (header.offsetHeight - bounds.top) / distance));
        const time = fraction * duration;
        if (scene.art.currentTime !== time) {
            scene.art.currentTime = time;
            scene.progress.currentTime = time;
            content.classList.toggle("is-faded", fraction >= copyFadeEnd);
        }

        const textTime = content.matches(":focus-within") ? 0 : time;
        if (scene.content.currentTime !== textTime) scene.content.currentTime = textTime;
    }

    function scheduleFrame() {
        if (scene && !frame) frame = requestAnimationFrame(renderScene);
    }

    function syncScene() {
        if (!scenePreference.matches) {
            if (scene) Object.values(scene).forEach(animation => animation.cancel());
            scene = undefined;
            hero.classList.remove("has-scroll-scene");
            return;
        }

        if (!stage.animate || scene) return;
        hero.classList.add("has-scroll-scene");
        scene = {
            content: pausedAnimation(content, [
                { offset: 0, transform: "translateY(0) scale(1)", opacity: 1 },
                { offset: .13, transform: "translateY(-.25rem) scale(1)", opacity: 1, easing: "cubic-bezier(.4, 0, .7, 1)" },
                { offset: copyFadeEnd, transform: "translateY(-5.5rem) scale(.92)", opacity: 0 },
                { offset: 1, transform: "translateY(-6.5rem) scale(.9)", opacity: 0 },
            ]),
            art: pausedAnimation(art, [
                { offset: 0, transform: "translateY(0) scale(1) rotate(0deg)", opacity: 1, easing: "cubic-bezier(.25, 0, .7, 1)" },
                { offset: .27, transform: "translateY(-4svh) scale(1.07) rotate(2deg)", opacity: 1, easing: "cubic-bezier(.3, 0, .25, 1)" },
                { offset: .68, transform: "translateY(-17svh) scale(1.44) rotate(-8deg)", opacity: 1, easing: "cubic-bezier(.4, 0, .65, 1)" },
                { offset: 1, transform: "translateY(-30svh) scale(1.18) rotate(-13deg)", opacity: .18 },
            ]),
            progress: pausedAnimation(progress, [
                { transform: "scaleX(.16)" },
                { transform: "scaleX(1)" },
            ]),
        };
        renderScene();
    }

    window.addEventListener("scroll", scheduleFrame, { passive: true });
    window.addEventListener("resize", scheduleFrame);
    window.addEventListener("pageshow", scheduleFrame);
    content.addEventListener("focusin", scheduleFrame);
    content.addEventListener("focusout", scheduleFrame);
    scenePreference.addEventListener("change", syncScene);
    syncScene();

    stage.addEventListener("pointermove", event => {
        if (!parallax.matches || event.pointerType !== "mouse") return;

        const bounds = stage.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        hero.style.setProperty("--orbit-x", `${x * 28}px`);
        hero.style.setProperty("--orbit-y", `${y * 20}px`);
    });

    stage.addEventListener("pointerleave", () => {
        hero.style.removeProperty("--orbit-x");
        hero.style.removeProperty("--orbit-y");
    });
})();
