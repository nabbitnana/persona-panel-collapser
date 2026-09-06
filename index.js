// 人设面板折叠控制 - 适用于 TauriTavern / SillyTavern
// 在"用户设定管理"抽屉里加三/四个按钮，可以单独折叠/展开：
//   - 用户设定管理（人设列表）
//   - 当前人设（详情/描述编辑区）
//   - 全部折叠 / 全部展开
// 状态会存在 localStorage，下次打开面板时记住上次的折叠状态。

(function () {
    'use strict';

    const STORAGE_KEY = 'ppc_persona_panel_state_v1';
    const TOOLBAR_ID = 'ppc-toolbar';

    // 依次尝试这些 id / 关键字，兼容不同版本可能的差异。
    // 如果你的版本元素不是这些 id，请用浏览器"检查元素"确认真实 id，
    // 然后把它加进对应数组的第一位即可。
    const LIST_CANDIDATES = {
        ids: ['user_avatar_block', 'rm_print_personas_block', 'persona_list_block'],
        text: ['用户设定管理', 'Manage personas', 'Persona Management']
    };
    const CURRENT_CANDIDATES = {
        ids: ['persona_description_block', 'current_persona_block'],
        text: ['当前人设', 'Current Persona']
    };
    // 抽屉本体（智慧表情图标点开的那个面板）
    const DRAWER_IDS = ['user-settings-block', 'persona-management-block'];

    function getState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { /* ignore */ }
        return { list: true, current: true };
    }

    function setState(state) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function findDrawer() {
        for (const id of DRAWER_IDS) {
            const el = document.getElementById(id);
            if (el) return el;
        }
        return null;
    }

    // 在 root 范围内，优先按 id 找；找不到就按标题文字模糊匹配，
    // 返回该标题所在的、看起来像"一个区块"的祖先节点。
    function findBlock(root, candidates) {
        for (const id of candidates.ids) {
            const el = document.getElementById(id);
            if (el) return el;
        }
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let node;
        while ((node = walker.nextNode())) {
            const text = (node.childNodes.length && node.childNodes[0].nodeType === 3)
                ? node.textContent.trim()
                : '';
            if (!text || text.length > 30) continue;
            if (candidates.text.some(t => text.indexOf(t) === 0)) {
                // 往上找一个体积明显更大的容器作为"区块"
                let container = node.parentElement;
                let hops = 0;
                while (container && container.parentElement && hops < 3 &&
                    container.parentElement !== root) {
                    container = container.parentElement;
                    hops++;
                }
                return container || node;
            }
        }
        return null;
    }

    function applyCollapse(el, collapsed) {
        if (!el) return;
        el.style.display = collapsed ? 'none' : '';
    }

    function refresh(drawer, state) {
        const listBlock = findBlock(drawer, LIST_CANDIDATES);
        const currentBlock = findBlock(drawer, CURRENT_CANDIDATES);
        applyCollapse(listBlock, !state.list);
        applyCollapse(currentBlock, !state.current);
        return { listBlock, currentBlock };
    }

    function makeButton(label, onClick) {
        const b = document.createElement('div');
        b.className = 'menu_button';
        b.textContent = label;
        b.style.cssText = 'flex:1;text-align:center;font-size:12px;padding:4px 2px;white-space:nowrap;';
        b.addEventListener('click', onClick);
        return b;
    }

    function ensureToolbar(drawer) {
        if (document.getElementById(TOOLBAR_ID)) return;

        const state = getState();
        const toolbar = document.createElement('div');
        toolbar.id = TOOLBAR_ID;
        toolbar.style.cssText =
            'display:flex;gap:6px;padding:6px 4px;position:sticky;top:0;z-index:30;' +
            'background:var(--SmartThemeBlurTintColor, inherit);border-bottom:1px solid var(--SmartThemeBorderColor, #4448);';

        const btnList = makeButton('人设列表', () => {
            state.list = !state.list;
            setState(state);
            refresh(drawer, state);
        });
        const btnCurrent = makeButton('当前人设', () => {
            state.current = !state.current;
            setState(state);
            refresh(drawer, state);
        });
        const btnCollapseAll = makeButton('全部折叠', () => {
            state.list = false;
            state.current = false;
            setState(state);
            refresh(drawer, state);
        });
        const btnExpandAll = makeButton('全部展开', () => {
            state.list = true;
            state.current = true;
            setState(state);
            refresh(drawer, state);
        });

        toolbar.append(btnList, btnCurrent, btnCollapseAll, btnExpandAll);
        drawer.prepend(toolbar);
    }

    function tick() {
        const drawer = findDrawer();
        if (!drawer) return;
        ensureToolbar(drawer);
        refresh(drawer, getState());
    }

    // 人设列表/详情区经常会因为切换人设、刷新头像等操作被重新渲染，
    // 所以用 MutationObserver 持续监听，重新应用折叠状态。
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(tick, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 首次加载也执行一次
    if (typeof jQuery !== 'undefined') {
        jQuery(tick);
    } else {
        document.addEventListener('DOMContentLoaded', tick);
    }
})();
