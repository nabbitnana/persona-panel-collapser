// 人设面板折叠控制 - 适用于 TauriTavern / SillyTavern
// 在"用户设定管理"抽屉里加几个按钮，可以单独折叠/展开：
//   - User列表（人设列表，#user_avatar_block）—— 默认展开
//   - 用户设定描述（"当前人设"里的描述文本框那一块）—— 默认折叠
//   - 插入位置（描述下面的插入位置下拉框那一块）—— 默认折叠
//   - 全局设置（切换通知/多重绑定/自动绑定 等开关那一块）—— 默认折叠
// 状态存 localStorage，下次打开面板记住上次状态。
//
// v3 改动说明（修复宽屏两栏布局下三个新按钮完全不生效的问题）：
//   上一版用"往上爬直到跟 #user_avatar_block 同一个父节点"来找区块，这在窄屏单栏布局下
//   凑巧能用，但宽屏下"用户设定管理"和"当前人设"是左右两栏，两边压根不在同一条祖先链上，
//   爬到 20 层都碰不到同一个父节点，直接返回 null，按钮自然没反应。
//   现在换成完全不依赖布局结构的办法：从标题文字所在的元素开始往上爬，每爬一层就检查
//   这一层里是否已经包含真正的控件（textarea / select / input / button），
//   一旦包含就停下来，返回这一层作为"区块"。这样无论是单栏还是两栏、
//   无论标题和内容隔了几层 div，都能定位到正确的范围。

(function () {
    'use strict';

    const STORAGE_KEY = 'ppc_persona_panel_state_v3';
    const TOOLBAR_ID = 'ppc-toolbar';
    const DRAWER_SELECTOR = '#persona-management-button .drawer-content';
    const LIST_ID = 'user_avatar_block';

    // 标题文字候选（中英文都试，取前缀匹配，找最短、最像"标题"的那个元素）。
    const DESC_LABELS = ['用户设定描述', 'Description'];
    const POSITION_LABELS = ['插入位置', 'Injection Position', 'Position'];
    const GLOBAL_LABELS = ['全局设置', 'Global Persona Settings', 'Global Settings'];

    function getState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) { /* ignore */ }
        // list 默认展开，其余三个默认折叠
        return { list: true, desc: false, position: false, global: false };
    }

    function setState(state) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function findDrawer() {
        return document.querySelector(DRAWER_SELECTOR);
    }

    // 在 root 内找"标题元素"：自身可见文字很短（<40字符）且以候选文字开头。
    // 用 TreeWalker 按文档顺序遍历，父节点先于子节点被访问到，
    // 所以拿到的通常就是"这一小段标题所在的最外层容器"。
    function findHeadingElement(root, labels) {
        if (!root) return null;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let node;
        while ((node = walker.nextNode())) {
            const text = node.textContent ? node.textContent.trim() : '';
            if (!text || text.length > 40) continue;
            if (labels.some(l => text.indexOf(l) === 0)) return node;
        }
        return null;
    }

    // 从 heading 往上爬，找到第一个"确实包含实际控件"的祖先，作为整个区块。
    // 最多爬 5 层，避免一路爬到抽屉根节点，把不相关的内容也裹进来。
    function findBlockForHeading(heading) {
        if (!heading) return null;
        let node = heading;
        for (let i = 0; i < 5 && node.parentElement; i++) {
            node = node.parentElement;
            if (node.querySelector('textarea, select, input, button, .menu_button, .checkbox_label')) {
                return node;
            }
        }
        return node;
    }

    function findBlocks() {
        const drawer = findDrawer();
        const listBlock = document.getElementById(LIST_ID);

        const descHeading = findHeadingElement(drawer, DESC_LABELS);
        const positionHeading = findHeadingElement(drawer, POSITION_LABELS);
        const globalHeading = findHeadingElement(drawer, GLOBAL_LABELS);

        return {
            listBlock,
            descBlock: findBlockForHeading(descHeading),
            positionBlock: findBlockForHeading(positionHeading),
            globalBlock: findBlockForHeading(globalHeading),
        };
    }

    function applyCollapse(el, collapsed) {
        if (!el) return;
        el.style.display = collapsed ? 'none' : '';
    }

    function refresh(state) {
        const { listBlock, descBlock, positionBlock, globalBlock } = findBlocks();
        applyCollapse(listBlock, !state.list);
        applyCollapse(descBlock, !state.desc);
        applyCollapse(positionBlock, !state.position);
        applyCollapse(globalBlock, !state.global);
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
            'display:flex;flex-wrap:wrap;gap:6px;padding:6px 4px;position:sticky;top:0;z-index:30;' +
            'background:var(--SmartThemeBlurTintColor, inherit);border-bottom:1px solid var(--SmartThemeBorderColor, #4448);';

        function toggle(key) {
            state[key] = !state[key];
            setState(state);
            refresh(state);
        }

        toolbar.append(
            makeButton('User列表', () => toggle('list')),
            makeButton('用户设定描述', () => toggle('desc')),
            makeButton('插入位置', () => toggle('position')),
            makeButton('全局设置', () => toggle('global')),
        );

        drawer.prepend(toolbar);
    }

    function tick() {
        const drawer = findDrawer();
        if (!drawer) return;
        ensureToolbar(drawer);
        refresh(getState());
    }

    // 人设列表/详情区经常因切换人设、刷新头像等操作被重新渲染，
    // 用 MutationObserver 持续监听，重新应用折叠状态。
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
