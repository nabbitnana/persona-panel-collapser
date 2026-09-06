// 人设面板折叠控制 - 适用于 TauriTavern / SillyTavern
// 在"用户设定管理"抽屉里加几个按钮，可以单独折叠/展开：
//   - User列表（人设列表，#user_avatar_block）—— 默认展开
//   - 用户设定描述（"当前人设"里的描述文本框那一块）—— 默认折叠
//   - 插入位置（描述下面的插入位置下拉框那一块）—— 默认折叠
//   - 全局设置（插入位置之后剩下的全部内容：链接/排序位置/人设标签/角色分组等）—— 默认折叠
// 状态存 localStorage，下次打开面板记住上次状态。
//
// 定位方式说明：
//   - 人设列表用确定存在的 id：#user_avatar_block（源码 getUserAvatarBlock/getUserAvatars 用的就是它）。
//   - "当前人设"下面的字段在源码里是散落的，没有统一容器，所以改成按可见标题文字（"用户设定描述"
//     "插入位置"）定位，再往上爬到跟 #user_avatar_block 同级的祖先节点，得到对应的整块区域。
//   - "全局设置"不逐个再猜"链接/排序位置/人设标签/..."的选择器，而是取"插入位置"区块之后、
//     同一层级里剩下的全部兄弟节点，打包成一组统一折叠/展开，这样底下具体有几块都不用管。
//
// 如果某个按钮点了没反应，大概率是对应的标题文字/结构和这里假设的不一致，
// 把审查元素看到的真实结构截图发出来，再调整 HEADING_LABELS 或定位逻辑即可。

(function () {
    'use strict';

    const STORAGE_KEY = 'ppc_persona_panel_state_v2';
    const TOOLBAR_ID = 'ppc-toolbar';
    const DRAWER_SELECTOR = '#persona-management-button .drawer-content';
    const LIST_ID = 'user_avatar_block';

    // 用来识别"用户设定描述"和"插入位置"标题的候选文字（中英文都尝试，取前缀匹配）。
    const DESC_LABELS = ['用户设定描述', 'Description'];
    const POSITION_LABELS = ['插入位置', 'Injection Position', 'Position'];

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

    // 在 root 内找一个"标题元素"：文字很短（<40字符）且以候选文字开头。
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

    function findBlocks() {
        const listBlock = document.getElementById(LIST_ID);
        if (!listBlock) return { listBlock: null, descBlock: null, positionBlock: null, globalBlocks: [] };

        const drawer = findDrawer();
        const descHeading = findHeadingElement(drawer, DESC_LABELS);
        const positionHeading = findHeadingElement(drawer, POSITION_LABELS);

        const descBlock = climbToSiblingLevel(descHeading, listBlock);
        const positionBlock = climbToSiblingLevel(positionHeading, listBlock);

        let globalBlocks = [];
        const parent = listBlock.parentElement;
        if (parent && positionBlock) {
            const siblings = Array.from(parent.children);
            const idx = siblings.indexOf(positionBlock);
            if (idx !== -1) {
                globalBlocks = siblings.slice(idx + 1).filter(el => el.id !== TOOLBAR_ID);
            }
        }

        return { listBlock, descBlock, positionBlock, globalBlocks };
    }

    function applyCollapse(el, collapsed) {
        if (!el) return;
        el.style.display = collapsed ? 'none' : '';
    }

    function refresh(state) {
        const { listBlock, descBlock, positionBlock, globalBlocks } = findBlocks();
        applyCollapse(listBlock, !state.list);
        applyCollapse(descBlock, !state.desc);
        applyCollapse(positionBlock, !state.position);
        globalBlocks.forEach(el => applyCollapse(el, !state.global));
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
