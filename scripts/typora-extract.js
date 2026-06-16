// ============================================================
// 在 Typora 的 Safari Web Inspector 控制台里粘贴运行这段。
// 它会采集侧栏 (#typora-sidebar) 的结构 + 关键 computedStyle，
// 输出一段 JSON 文本，全选复制贴回给 AI 即可。
//
// 用法：
//   1) Safari → 开发菜单 → 选 Typora 的页面
//   2) 在打开的 Web Inspector 里切到「控制台 Console」
//   3) 粘贴本文件全部内容，回车
//   4) 看到打印的 JSON，右键 "复制" 整段结果
//
// 分别在两种状态下各跑一次：
//   A) 大纲态：Typora 侧栏停在 Outline（你默认就是这个）
//   B) 文件树态：点侧栏左上角图标切到 Files，并打开一个含子目录的文件夹
// ============================================================
(function () {
  function cs(el, props) {
    if (!el) return null;
    var s = getComputedStyle(el);
    var o = {};
    props.forEach(function (p) { o[p] = s.getPropertyValue(p); });
    var r = el.getBoundingClientRect();
    o._box = [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    return o;
  }
  function dumpNode(el) {
    // 输出标签结构：tag + class + 关键属性 + 子节点递归，不输出文本内容
    if (!el || el.nodeType !== 1) return null;
    var o = { tag: el.tagName.toLowerCase(), cls: el.className && el.className.baseVal !== undefined ? el.className.baseVal : (el.className || '') };
    ['id', 'data-path', 'data-has-sub', 'data-is-directory', 'data-sidebar-tab', 'role', 'tabindex', 'aria-hidden'].forEach(function (a) {
      var v = el.getAttribute(a);
      if (v !== null) o[a] = v;
    });
    var kids = el.children;
    if (kids && kids.length) {
      o.children = [];
      for (var i = 0; i < kids.length && i < 20; i++) {
        var d = dumpNode(kids[i]);
        if (d) o.children.push(d);
      }
    }
    return o;
  }

  var sb = document.querySelector('#typora-sidebar');
  if (!sb) { console.log('%c[extract] 没找到 #typora-sidebar，请确认 Typora 侧栏已展开', 'color:red'); return; }

  var tab = sb.getAttribute('data-sidebar-tab') || sb.className.match(/active-tab-(\w+)/)?.[1] || '?';
  var result = {
    state: tab,
    sidebarClass: sb.className,
    bodyClass: document.body.className,
    geometry: {
      sidebar: cs(sb, ['display', 'flex-direction', 'position', 'width', 'background-color', 'border-right', 'font-size', 'color']),
      sidebarTabs: cs(document.querySelector('.sidebar-osx-tab'), ['display', 'height', 'border-bottom', 'line-height']),
      sidebarContent: cs(document.querySelector('#sidebar-content'), ['display', 'position', 'top', 'bottom', 'flex', 'overflow-y']),
      outlineContent: cs(document.querySelector('#outline-content'), ['display', 'overflow-x', 'overflow-y', 'line-height', 'max-height']),
      outlineItem: cs(document.querySelector('#outline-content .outline-item'), ['display', 'position', 'cursor', 'color', 'background-color']),
      outlineLabel: cs(document.querySelector('#outline-content .outline-label'), ['display', 'vertical-align', 'color', 'font-size']),
      outlineExpander: cs(document.querySelector('#outline-content .outline-expander'), ['display', 'width', 'font-family', 'font-size']),
      // 文件树态才有（大纲态会是 null，正常）
      fileTree: cs(document.querySelector('#file-library-tree'), ['display', 'overflow-x', 'overflow-y']),
      fileNodeRoot: cs(document.querySelector('#file-library-tree .file-node-root'), ['padding-left']),
      fileNode: cs(document.querySelector('#file-library-tree .file-library-node'), ['position', 'padding-left']),
      fileNodeContent: cs(document.querySelector('#file-library-tree .file-node-content'), ['display', 'padding-top', 'padding-right', 'line-height', 'color', 'cursor']),
      fileNodeIcon: cs(document.querySelector('#file-library-tree .file-node-icon'), ['display', 'float', 'line-height', 'min-height', 'margin-right']),
      fileNodeOpenState: cs(document.querySelector('#file-library-tree .file-node-open-state'), ['display', 'min-width']),
      fileNodeTitle: cs(document.querySelector('#file-library-tree .file-node-title'), ['display', 'white-space', 'overflow']),
      fileNodeBackground: cs(document.querySelector('#file-library-tree .file-tree-node.active > .file-node-background'), ['background-color', 'border-left', 'border-color']),
    },
    // 结构：只取关键区域，避免输出过大
    struct: {
      outlineContent: dumpNode(document.querySelector('#outline-content')),
      fileLibraryTree: dumpNode(document.querySelector('#file-library-tree')),
    },
    counts: {
      outlineItems: document.querySelectorAll('#outline-content .outline-item').length,
      fileNodes: document.querySelectorAll('#file-library-tree .file-library-node').length,
    }
  };

  // 打印两次：一次美化（方便人看），一次压缩（方便复制）
  var json = JSON.stringify(result);
  console.log('%c===== Typora 侧栏采集结果 (' + tab + ' 态) =====', 'color:#0a0;font-weight:bold');
  console.log(JSON.stringify(result, null, 1));
  console.log('%c----- 复制下面这一整行 (压缩版) -----', 'color:#06c;font-weight:bold');
  console.log(json);
  // 也写入剪贴板（若浏览器允许）
  try { navigator.clipboard && navigator.clipboard.writeText(json).then(function(){ console.log('%c[已自动复制到剪贴板]', 'color:#0a0'); }); } catch (e) {}
  return json;
})();
