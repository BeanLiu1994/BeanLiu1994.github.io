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
    const parallax = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");

    hero.addEventListener("pointermove", event => {
        if (!parallax.matches || event.pointerType !== "mouse") return;

        const bounds = hero.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        hero.style.setProperty("--orbit-x", `${x * 28}px`);
        hero.style.setProperty("--orbit-y", `${y * 20}px`);
    });

    hero.addEventListener("pointerleave", () => {
        hero.style.removeProperty("--orbit-x");
        hero.style.removeProperty("--orbit-y");
    });
})();
