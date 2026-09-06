// 人设面板折叠控制 - 适用于 TauriTavern / SillyTavern
// 在"用户设定管理"抽屉里加几个按钮，可以单独折叠/展开：
//   - 用户设定管理（人设列表，#user_avatar_block）
//   - 当前人设（详情/描述编辑区，围绕 #persona_description 的那一块）
//   - 全部折叠 / 全部展开
// 状态会存在 localStorage，下次打开面板时记住上次的折叠状态。
//
// 选择器依据（已对照 SillyTavern 官方源码 public/scripts/personas.js 核实）：
//   - 抽屉本体：document.querySelector('#persona-management-button .drawer-content')
//     （源码里 isPersonaPanelOpen() 就是用这个选择器判断面板是否打开的）
//   - 人设列表：#user_avatar_block（源码里 getUserAvatarBlock()/getUserAvatars() 都是
//     $('#user_avatar_block').append(...) / $(listId) 操作这个元素）
//   - "当前人设"没有单独的包裹容器，是散落的一批元素（#persona_description、#your_name、
//     #persona_connections_list 等）。所以这里改用"结构关系"定位：从确定存在的
//     #persona_description 往上找父节点，直到找到一个和 #user_avatar_block 同级
//     （父节点相同）的祖先，那就是"当前人设"整块区域。

(function () {
    'use strict';

    const STORAGE_KEY = 'ppc_persona_panel_state_v1';
    const TOOLBAR_ID = 'ppc-toolbar';
    const DRAWER_SELECTOR = '#persona-management-button .drawer-content';
    const LIST_ID = 'user_avatar_block';
    const CURRENT_ANCHOR_ID = 'persona_description';

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
        return document.querySelector(DRAWER_SELECTOR);
    }

    // 从 target 往上爬，直到找到一个跟 referenceSibling 同一个父节点的祖先节点，
    // 也就是跟 referenceSibling 处于"同一层级/同一个区块"的容器。
    function climbToSiblingLevel(target, referenceSibling) {
        if (!target || !referenceSibling || !referenceSibling.parentElement) return null;
        let node = target;
        const targetParent = referenceSibling.parentElement;
        let hops = 0;
        while (node && node.parentElement !== targetParent && hops < 20) {
            node = node.parentElement;
            hops++;
        }
        return node && node.parentElement === targetParent ? node : null;
    }

    function findBlocks() {
        const listBlock = document.getElementById(LIST_ID);
        const anchor = document.getElementById(CURRENT_ANCHOR_ID);
        const currentBlock = listBlock && anchor ? climbToSiblingLevel(anchor, listBlock) : null;
        return { listBlock, currentBlock };
    }

    function applyCollapse(el, collapsed) {
        if (!el) return;
        el.style.display = collapsed ? 'none' : '';
    }

    function refresh(drawer, state) {
        const { listBlock, currentBlock } = findBlocks();
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
