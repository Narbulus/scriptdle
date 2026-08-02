import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'preact/hooks';

/**
 * Themed listbox replacing the native <select> in game Controls.
 *
 * Native <select> hands its option list to the OS, which is why the menu
 * arrived white/sans-serif regardless of CSS. This renders the list itself,
 * styled from --pack-* vars so every pack keeps theming itself.
 *
 * Keyboard: ArrowUp/Down move, Home/End jump, Enter/Space pick, Esc closes,
 * printable keys type-to-jump (the one native affordance worth preserving).
 *
 * props:
 *   id            base id, used for aria wiring + test ids
 *   label         placeholder shown when nothing is selected ("Which Film?")
 *   value         selected option value ('' when none)
 *   options       [{ value, label }]
 *   onChange      (value) => void        — note: value, not an event
 *   disabled      dim + unopenable (no film chosen yet)
 *   locked        correct guess: solid rule, caret becomes a check, unopenable
 *   count         optional right-side hint in the menu header ("8 IN PACK")
 *   align         'left' | 'right' — which half the menu anchors to on wide layouts
 *   onOpen        called when the menu opens (used to stop the dice shuffle)
 *   valueRef      ref callback on the selected label span, so the caller can
 *                 measure overflow and drive the marquee for long titles
 */
export function ScriptSelect({
    id,
    label,
    value,
    options,
    onChange,
    disabled = false,
    locked = false,
    count,
    align = 'left',
    onOpen,
    valueRef
}) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const [anchor, setAnchor] = useState(null);
    const [query, setQuery] = useState('');
    const rootRef = useRef(null);
    const menuRef = useRef(null);
    const listRef = useRef(null);
    const typedRef = useRef('');
    const typeTimer = useRef(null);

    const inert = disabled || locked;
    const current = options.find(o => o.value === value) || null;

    // Typeahead: substring, not prefix — "azkaban" should find the third film.
    const q = query.trim().toLowerCase();
    const shown = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
    const selectedIndex = shown.findIndex(o => o.value === value);

    // Derived rather than trusted from state: filtering renumbers the list, so
    // `active` can briefly point past the end or sit at -1 before the effect
    // that resets it has run. Enter must never fall through in that window.
    const activeIndex = active >= 0 && active < shown.length
        ? active
        : (shown.length > 0 ? 0 : -1);

    const close = useCallback(() => {
        setOpen(false);
        setActive(-1);
        setQuery('');
    }, []);

    // Bring a row into the scroll port. Deliberately not scrollIntoView —
    // that scrolls ancestor containers too, which fights the script area's
    // own managed scrolling. Deferred a frame so it runs after the render
    // that created (or renumbered) the rows.
    const scrollToIndex = useCallback((i) => {
        const run = () => {
            const list = listRef.current;
            if (!list || i < 0) return false;
            const row = list.children[i];
            if (!row) return false;
            // Measured from rects, not offsetTop: the list is not a positioned
            // element, so offsetTop resolves against the menu and would carry
            // the header's height into every calculation.
            const listRect = list.getBoundingClientRect();
            const rowRect = row.getBoundingClientRect();
            const top = rowRect.top - listRect.top + list.scrollTop;
            const bottom = top + rowRect.height;
            if (top < list.scrollTop) list.scrollTop = top;
            else if (bottom > list.scrollTop + list.clientHeight) {
                list.scrollTop = bottom - list.clientHeight;
            }
            return true;
        };
        // Rows already exist for plain arrow movement, so scroll now. Only the
        // open/filter cases need to wait for a render, and those fall back to
        // a timeout rather than rAF, which does not fire in a hidden webview.
        if (!run()) setTimeout(run, 0);
    }, []);

    const openMenu = useCallback((startIndex) => {
        if (inert) return;
        if (onOpen) onOpen();
        const start = startIndex !== undefined ? startIndex : (selectedIndex >= 0 ? selectedIndex : 0);
        setActive(start);
        setOpen(true);
        scrollToIndex(start);
    }, [inert, onOpen, selectedIndex, scrollToIndex]);

    // Keyboard movement scrolls; hover deliberately does not, so moving the
    // pointer into the menu never yanks the list to the row under the cursor.
    // Driven here rather than from an effect on `active`, because pressing
    // End when the hover already left that row active is a no-op state change
    // and would not re-run an effect.
    const moveActive = useCallback((next) => {
        setActive(next);
        scrollToIndex(next);
    }, [scrollToIndex]);

    const pick = useCallback((v) => {
        onChange(v);
        close();
    }, [onChange, close]);

    // Dismiss on outside pointer, or when the window really loses focus — a
    // webview can lose it abruptly and an orphaned open menu looks broken.
    useEffect(() => {
        if (!open) return;
        const onDown = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) close();
        };
        // Focusing the filter field raises the on-screen keyboard, and several
        // Android webviews report that as a window blur. Closing on it would
        // shut the menu the moment someone taps the field, so only treat blur
        // as a dismissal when focus has actually left the component.
        const onBlur = () => {
            const root = rootRef.current;
            if (root && root.contains(document.activeElement)) return;
            close();
        };
        document.addEventListener('pointerdown', onDown);
        window.addEventListener('blur', onBlur);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            window.removeEventListener('blur', onBlur);
        };
    }, [open, close]);

    // The menu is positioned `fixed` and anchored to the trigger rather than
    // laid out inside it. The Reddit footer sets `overflow: hidden` (it
    // animates its own max-height), which clipped an absolutely-positioned
    // menu to the top of the footer; fixed positioning escapes that without
    // moving the node out of the component, so outside-click, focus and
    // keyboard handling all still work off `rootRef`.
    useLayoutEffect(() => {
        if (!open) return;

        const place = () => {
            const el = rootRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            setAnchor({
                left: r.left,
                width: r.width,
                bottom: window.innerHeight - r.top + 10,
                // Never taller than the room above the trigger
                maxHeight: Math.max(120, r.top - 18),
            });
        };

        // Capture phase catches scrolls on any ancestor, but it also catches
        // the menu list scrolling itself — repositioning on those re-rendered
        // the whole menu on every wheel tick, which is what made scrolling
        // feel like it was being fought.
        const onScroll = (e) => {
            if (menuRef.current && e.target && e.target.nodeType && menuRef.current.contains(e.target)) return;
            place();
        };

        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', onScroll, true);
        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', onScroll, true);
        };
    }, [open]);

    // A new query renumbers the list, so start back at the top.
    useEffect(() => {
        if (!open) return;
        setActive(0);
        if (listRef.current) listRef.current.scrollTop = 0;
    }, [query]);

    // Shared by the trigger and the filter input. `typing` is true for the
    // input, where printable keys belong to the field rather than type-to-jump.
    const handleKeys = (e, typing) => {
        if (inert) return;
        const n = shown.length;
        const k = e.key;

        if (k === 'ArrowDown' || k === 'ArrowUp') {
            e.preventDefault();
            if (!open) return openMenu();
            if (n === 0) return;
            const d = k === 'ArrowDown' ? 1 : -1;
            return moveActive((activeIndex + d + n) % n);
        }
        if (k === 'Home' && open && n > 0) { e.preventDefault(); return moveActive(0); }
        if (k === 'End' && open && n > 0) { e.preventDefault(); return moveActive(n - 1); }
        if (k === 'Enter' || (k === ' ' && !typing)) {
            e.preventDefault();
            if (!open) return openMenu();
            if (activeIndex >= 0 && shown[activeIndex]) pick(shown[activeIndex].value);
            return;
        }
        if (k === 'Escape' && open) {
            e.preventDefault();
            close();
            const trigger = rootRef.current && rootRef.current.querySelector('.script-select-trigger');
            if (trigger) trigger.focus();
            return;
        }
        if (k === 'Tab' && open) return close();

        // Type-to-jump only from the closed/focused trigger; inside the filter
        // field the same keystrokes are the query.
        if (!typing && k.length === 1 && /[a-z0-9]/i.test(k)) {
            clearTimeout(typeTimer.current);
            typedRef.current += k.toLowerCase();
            typeTimer.current = setTimeout(() => { typedRef.current = ''; }, 700);
            const i = options.findIndex(o => o.label.toLowerCase().startsWith(typedRef.current));
            if (i >= 0) {
                if (!open) openMenu(i);
                else moveActive(i);
            }
        }
    };

    const listId = `${id}-listbox`;

    return (
        <div
            className={`script-select ${open ? 'is-open' : ''} ${locked ? 'is-locked' : ''} ${disabled ? 'is-disabled' : ''}`}
            ref={rootRef}
        >
            <button
                type="button"
                id={id}
                data-testid={id}
                className="script-select-trigger"
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listId}
                aria-activedescendant={open && activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined}
                aria-label={label}
                aria-disabled={inert}
                onClick={() => (open ? close() : openMenu())}
                onKeyDown={(e) => handleKeys(e, false)}
            >
                <span className="script-select-value">
                    {current
                        ? <span ref={valueRef} key={current.value}>{current.label}</span>
                        : label}
                </span>
                <span className="script-select-caret" aria-hidden="true">
                    {locked ? '✓' : open ? '▲' : '▼'}
                </span>
            </button>

            {open && anchor && (
                <div
                    className={`script-select-menu align-${align}`}
                    ref={menuRef}
                    style={{
                        left: `${anchor.left}px`,
                        width: `${anchor.width}px`,
                        bottom: `${anchor.bottom}px`,
                        maxHeight: `${anchor.maxHeight}px`,
                    }}
                >
                    <div className="script-select-menu-head">
                        <span>{label}</span>
                        {count ? <span className="script-select-menu-count">{count}</span> : null}
                    </div>
                    <div
                        className="script-select-list"
                        id={listId}
                        role="listbox"
                        aria-label={label}
                        ref={listRef}
                    >
                        {shown.map((o, i) => (
                            <button
                                type="button"
                                key={o.value}
                                id={`${id}-opt-${i}`}
                                role="option"
                                aria-selected={o.value === value}
                                className={`script-select-option${i === activeIndex ? ' is-active' : ''}${o.value === value ? ' is-selected' : ''}`}
                                onClick={() => pick(o.value)}
                                onMouseEnter={() => setActive(i)}
                            >
                                <span className="script-select-mark" aria-hidden="true">
                                    {o.value === value ? '✓' : ''}
                                </span>
                                <span className="script-select-option-label">{o.label}</span>
                            </button>
                        ))}
                        {shown.length === 0 && (
                            <div className="script-select-empty">
                                {options.length === 0 ? 'Pick a film first.' : `Nothing matches “${query.trim()}”.`}
                            </div>
                        )}
                    </div>

                    {/* Filter sits at the bottom: it is the end of the menu
                        nearest the trigger, so it lands under the thumb on a
                        phone rather than at the far top of a tall list. */}
                    {options.length > 6 && (
                        <div className="script-select-filter">
                            <span className="script-select-filter-icon" aria-hidden="true">⌕</span>
                            <input
                                type="text"
                                className="script-select-filter-input"
                                data-testid={`${id}-filter`}
                                value={query}
                                placeholder="Type to filter…"
                                aria-label={`Filter ${label}`}
                                aria-controls={listId}
                                autocomplete="off"
                                autocorrect="off"
                                autocapitalize="off"
                                spellcheck={false}
                                onInput={(e) => setQuery(e.currentTarget.value)}
                                onKeyDown={(e) => handleKeys(e, true)}
                            />
                            {query && (
                                <button
                                    type="button"
                                    className="script-select-filter-clear"
                                    aria-label="Clear filter"
                                    onClick={() => setQuery('')}
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
