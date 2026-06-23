// Typora 原生 sidebar 骨架 HTML，逐字节搬运自
// /Applications/Typora.app/Contents/Resources/TypeMark/index.html (175-455 行)。
//
// 方案 A「原生骨架直供」的核心：这份 HTML 与 Typora 1:1，不经任何重写，
// 直接注入 document.body（#root 之外），使 Typora base-control.css / window.css
// 的全局 id/class 选择器（#typora-sidebar / #outline-content / #file-library 等）
// 在与 Typora 完全相同的 DOM 位置生效。
//
// 关键复刻点（对照 index.html 行号）：
//  - #toc-dropmenu（175-182）浮动大纲弹层
//  - #typora-sidebar 全树（184-451）
//  - 4 个 <script type="text/x-template">（247/289/300/306/312）—— Typora 用 $.clone
//    消费这些模板渲染搜索结果/文件列表/文件树节点；保留它们以便后续 JS 克隆
//  - 内联 SVG sprite（749-766）find-and-replace-icon-*
//  - 搜索框搬运（1421-1426）：macOS 形态下 #file-library-search-panel 内容
//    拼进 #ty-sidebar-search-tabs，见 applySidebarSearchPanelRelocation()
//
// 与原版的唯一差异：删掉所有 Typora 专属、本项目不实现的面板
// （#md-searchpanel / #typora-quick-open / context-menu / modal 等），只保留 sidebar 相关。

export const TYPORA_SHELL_HTML = `
<div aria-hidden="true" class="dropdown-menu stopselect dropmenu" id="toc-dropmenu" role="menu">
	<div class="outline-title-wrapper">
		<span class="outline-title" data-localize="Outline" data-lg="Front">Outline</span>
		<span class="btn fa fa-arrow-circle-left" id="pin-outline-btn"></span>
	</div>
	<div class="divider outline-title-divider"></div>
	<div role="list" id="toc-content" class="outline-content" data-after-content="Outline is Empty."></div>
</div>

<div aria-hidden="true" class="stopselect dropmenu sidebar-menu" id="typora-sidebar" role="menu">
	<div class="info-panel-tab-wrapper ty-tab-wrapper">
		<div style="flex:1;"></div>
		<div class="info-panel-tab" id="info-panel-tab-file">
			<div class="info-panel-tab-title" data-localize="Files" data-lg="Front">Files</div>
			<div class="info-panel-tab-border"></div>
		</div>
		<div class="info-panel-tab" id="info-panel-tab-search-back">
			<div class="info-panel-tab-title" data-localize="Files" data-lg="Front">Files</div>
			<div class="info-panel-tab-border"></div>
		</div>
		<div style="flex:1;"></div>
		<div class="info-panel-tab" id="info-panel-tab-outline">
			<div class="info-panel-tab-title" data-localize="Outline" data-lg="Front">Outline</div>
			<div class="info-panel-tab-border"></div>
		</div>
		<div class="info-panel-tab" id="info-panel-tab-search">
			<div class="info-panel-tab-title" data-localize="Search" data-lg="Front">Search</div>
			<div class="info-panel-tab-border"></div>
		</div>
		<div style="flex:1;"></div>
	</div>
	<div class="sidebar-osx-tab ty-tab-wrapper">
		<div class="sidebar-tabs">
			<div class="sidebar-tab-btn" id="switch-sidebar-icon"><span class="ty-icon ty-three-cells" ty-hint="Switch to File List view"></span></div>
			<div class="sidebar-tab" id="sidepanel-segmented-input-files"></div>
			<div class="sidebar-tab" id="sidepanel-segmented-input-outline" data-localize="Outline" data-lg="Front">Outline</div>
			<div class="sidebar-tab-btn" id="sidebar-search-btn" ty-hint="Search">
				<span class="ion-ios7-search-strong"></span>
			</div>
		</div>
		<div class="ty-sidebar-search-panel" id="ty-sidebar-search-tabs">
			<div class="sidebar-tab-btn" id="ty-sidebar-search-back-btn"><span class="ty-icon ty-left-arrow" ty-hint="Close Search"></span></div>
		</div>
	</div>
	<div class="sidebar-content" id="sidebar-content">
		<div id="file-library-search">
			<div id="file-library-search-panel" class="ty-sidebar-search-panel" >
				<input type="search" id="file-library-search-input" placeholder="Search" aria-label="Search files" autocomplete="off" data-localize="Search">
				<span ty-hint="Case Sensitive" id="filesearch-case-option-btn" class="searchpanel-search-option-btn" aria-label="Case Sensitive">
					<svg class="icon"><use xlink:href="#find-and-replace-icon-case"></use></svg>
				</span>
				<span ty-hint="Whole Word" id="filesearch-word-option-btn" class="searchpanel-search-option-btn" aria-label="Whole Word">
					<svg class="icon"><use xlink:href="#find-and-replace-icon-word"></use></svg>
				</span>
				<span ty-hint="Regular Expression" id="filesearch-regexp-option-btn" class="searchpanel-search-option-btn" aria-label="Regular Expression">
					<svg class="icon"><use xlink:href="#find-and-replace-icon-regexp"></use></svg>
				</span>
				<span class="btn close-btn" aria-label="Close outline filter" id="close-outline-filter-btn" style="display:none;">
					<span class="ion-close-round"></span>
				</span>
			</div>
			<div id="file-library-search-result">
			</div>
			<script id="file-search-item-template" type="text/x-template">
				<div class="ty-search-item">
					<div class="ty-search-item-summary">
						<div class="ty-search-item-collapse-icon">
							<i class="fa fa-caret-right"></i>
							<i class="fa fa-caret-down"></i>
						</div>
						<div style="display:-webkit-flex;display:flex;">
							<div class="file-list-item-file-name">
								<span class="file-list-item-file-name-part"></span><span class="file-list-item-file-ext-part"></span>
							</div>
							<div class="file-list-item-right"><span class="file-list-item-count">0</span></div>
						</div>
						<div class="file-list-item-parent-loc"></div>
					</div>
					<div class="ty-search-item-matches"></div>
				</div>
			</script>
		</div>
		<div id="outline-content" class="outline-content sidebar-content-content" data-after-content="Outline is Empty."></div>
		<div id="file-library" class="sidebar-content-content">
			<div id="file-library-tree" class="no-selection" data-state="rendering" data-after-content="No Folder is Opened."></div>
			<div id="file-library-list" class="no-selection" data-state="">
				<div id="sidebar-loading-template" class="file-list-item">
					<div class="sidebar-loading">
						<div class="typora-quick-open-info"><span data-localize="Loading" data-lg="Front">Loading</span></div>
						<div class="typora-search-spinner"><div class="rect1"></div><div class="rect2"></div><div class="rect3"></div><div class="rect4"></div><div class="rect5"></div></div>
					</div>
					<div class="oversize-list-template">
						<div class="oversize-list-template-mark">
							<i class="fa fa-exclamation-triangle" aria-hidden="true"></i>
						</div>
						<div data-localize="Selected folders contains too many files. \\nPlease switch to <a id='switch-to-tree-on-oversize'>File Tree view</a> for better performance." data-lg='Front' data-lt='html'>
							Selected folders contains too many files.
							Please switch to <a id="switch-to-tree-on-oversize">File Tree view</a> for better performance.
						</div>
					</div>
				</div>
				<div id="file-library-list-children" data-after-content="No Files Available">
				</div>
			</div>
			<script id="file-list-item-template" type="text/x-template">
				<div class="file-list-item file-library-node file-library-file-node" data-create-date="" data-path="" data-parent-path="" tabindex="-1">
					<div class="file-list-item-parent-loc">/</div>
					<div class="file-list-item-time"></div>
					<div class="file-list-item-file-name">
						<span class="file-list-item-file-name-part"></span><span class="file-list-item-file-ext-part"></span>
					</div>
					<div class="file-list-item-summary"></div>
				</div>
			</script>
			<script id="folder-menu-item-template" type="text/x-template">
				<li role="presentation" class="folder-menu-item file-action-item folder-menu-groupm show" ty-hint-pos="right">
					<a role="menuitem" tabindex="-1" href="#"><i class="fa fa-folder-o"></i><span style="flex:1;overflow: hidden;text-overflow: ellipsis;"></span><i class="fa fa-thumb-tack sidebar-folder-right-icon sidebar-folder-pin" ty-hint="Pin"></i><i class="fa fa-trash-o sidebar-folder-right-icon sidebar-folder-remove" ty-hint="Remove from List"></i></a>
				</li>
			</script>
			<script id="sidebar-loading-template" type="text/x-template">
				<div class="sidebar-loading-template">
				</div>
			</script>
			<script id="file-library-node-template" type="text/x-template">
				<div class="file-library-node file-tree-node" data-path="" data-has-sub="false" tabindex="-1">
					<div class="file-node-background">
					</div>
					<div class="file-node-content" draggable="true">
						<span class="file-node-open-state">
							<i class="fa fa-caret-right"></i><i class="fa fa-caret-down"></i>
						</span>
						<i class="file-node-icon"></i>
						<span class="file-node-title"><span class="file-node-title-name-part"></span><span class="file-node-title-ext-part"></span></span>
						<div class="file-tree-rename-div">
							<input class="file-tree-rename-input" />
						</div>
					</div>
					<div class="file-node-children">
					</div>
				</div>
			</script>
		</div>
		<div id="file-info-content" class="sidebar-content-content" style="display:none">
			<div id="file-info-meta-group">
				<div id="file-info-last-saved-sub" class="file-info-item-subtitle">Saved just now</div>
				<div class="file-info-title file-info-field ">
					<div id="file-info-filename" class="file-info-field-value">Utitled.md</div>
					<div id="file-info-filename-input-area" class="file-info-field-value" style="display:none;">
						<input id="file-info-filename-input" /> <span id="file-info-filename-input-ext"></span></div>
				</div>
				<div class="file-info-field" id="file-info-file-path">
					<i class="fa fa-folder-o file-info-field-key"></i>
					<span class="file-info-field-value"></span>
				</div>
				<div class="file-info-field" id="file-info-last-modified">
					<i class="fa fa-clock-o file-info-field-key"></i>
					<span class="file-info-field-value"></span>
				</div>
			</div>
			<div id="file-info-save-group">
				<div class="file-info-item-subtitle">This is a New Document</div>
				<div id="file-info-save-btn" class="file-info-save-btn">Save Now</div>
			</div>
			<div id="file-info-contet-group">
				<div class="file-info-item-subtitle">Content</div>
				<div class="file-info-field file-info-field-read"><span class="file-info-field-read-value" id="file-info-field-read-value-minutes">0</span>minutes</div>
				<div class="file-info-field file-info-field-read"><span class="file-info-field-read-value" id="file-info-field-read-value-word">0</span>words</div>
				<div class="file-info-field file-info-field-read"><span class="file-info-field-read-value" id="file-info-field-read-value-ch">0</span>characters</div>
			</div>
		</div>
	</div>
	<div class="sidebar-footer no-selection" id="ty-sidebar-footer">
		<div style="display: -webkit-flex;display: flex;background:inherit;">
			<div class="sidebar-footer-item footer-item-right footer-btn file-action-item not-empty-menu-group" id="sidebar-new-file-btn" ty-hint="New File">
				<span class="ty-icon ty-add" style="position:relative;top:1px;"></span>
			</div>
			<div class="sidebar-footer-item footer-item-left footer-btn outline-action-item" id="unpin-outline-btn" ty-hint="Unpin Outline Panel">
				<span>
					<span class="ty-icon ty-export1"></span>
					<span></span>
				</span>
			</div>
			<div class="sidebar-footer-main-item" id="sidebar-menu-btn">
				<span class="sidebar-footer-item">
					<span class="sidebar-footer-main-item-label" id="sidebar-footer-main-item-label">
						Open Folder...
					</span>
					<span class="footer-btn">
						<span class="ty-icon ty-dots-v" aria-hidden="true"></span>
					</span>
				</span>
				<ul id="sidebar-files-menu" class="dropdown-menu" role="menu" aria-labelledby="drop5" tabindex="-1">
					<li role="presentation" class="menuitem-group-label file-action-item not-empty-menu-group">
						<span data-localize="Action" data-lg="Front">Action</span>
						<span class="ty-icon ty-delete-button" ty-hint="Close Sidebar Menu" id="close-sidebar-menu-btn"></span>
					</li>
					<li role="presentation" class="file-action-item not-empty-menu-group">
						<a role="menuitem" tabindex="-1" href="#" id="new-file-from-sidebar-menu" data-localize="New File" data-lg="Front">New File</a>
					</li>
					<li role="presentation" class="file-action-item not-empty-menu-group">
						<a role="menuitem" tabindex="-1" href="#" id="search-from-sidebar-menu" data-localize="Search" data-lg="Menu">Search</a>
					</li>
					<li role="presentation" class="file-action-item not-empty-menu-group">
						<a role="menuitem" tabindex="-1" href="#" id="reveal-folder-from-sidebar-menu" data-localize="Reveal in Finder" data-lg="Front">Reveal in Finder</a>
					</li>
					<li role="presentation" class="file-action-item not-empty-menu-group">
						<a role="menuitem" tabindex="-1" href="#" id="open-folder-from-sidebar-menu" data-localize="Open Folder..." data-lg="Front">Open Folder...</a>
					</li>
					<li role="presentation" class="file-action-item not-empty-menu-group">
						<a role="menuitem" tabindex="-1" href="#" id="refresh-from-sidebar-menu" data-localize="Refresh Folder" data-lg="Front">Refresh Folder</a>
					</li>
					<li role="presentation" class="menuitem-group-label file-action-item file-sort-item not-empty-menu-group">
						<span data-localize="Sort" data-lg="Front">Sort</span>
						<span class="sort-button-area">
							<span>
								<span id="ty-group-by-folder-btn" class="ty-icon ty-package ty-side-sort-btn active" ty-hint="Group By Folder"></span>
							</span>
							<span>
								<span id="ty-sort-by-natural-btn" class="ty-icon ty-sort-by-natural ty-side-sort-btn ty-side-sort-btn2 active" ty-hint="Sort Naturally (Ascending)"></span>
								<span id="ty-sort-by-name-btn" class="ty-icon ty-sort-by-alphabet-a ty-side-sort-btn ty-side-sort-btn2" ty-hint="Sort by Name (Ascending)"></span>
								<span id="ty-sort-by-date-btn" class="ty-icon ty-sort-by-date-a ty-side-sort-btn ty-side-sort-btn2" ty-hint="Sort by Modification Date (Ascending)"></span>
								<span id="ty-sort-by-create-btn" class="ty-icon ty-sort-new-up ty-side-sort-btn ty-side-sort-btn2" ty-hint="Sort by Creation Date (Ascending)"></span>
							</span>
						</span>
						<div class="clearfix"></div>
					</li>
					<li role="presentation" class="menuitem-group-label file-action-item folder-menu-group show">
						<span data-localize="Recent Locations" data-lg="Menu">Recent Locations</span>
					</li>
					<li role="presentation" class="folder-menu-item folder-menu-group selected-folder-menu-item file-action-item show">
						<a role="menuitem" tabindex="-1" href="#"><i class="fa fa-folder-o"></i><span></span></a>
					</li>
					<li role="presentation" class="menuitem-group-label file-action-item empty-menu-group" id="folder-menu-item-after" ><span data-localize="Location" data-lg="Front">Location</span></li>
					<li role="presentation" class="file-action-item empty-menu-group">
						<a role="menuitem" tabindex="-1" href="#" id="open-folder-from-sidebar-menu" data-localize="Open Folder..." data-lg="Front">Open Folder...</a>
					</li>
				</ul>
			</div>
			<div class="sidebar-footer-item footer-item-right footer-btn file-action-item not-empty-menu-group" id="switch-file-list-btn" ty-hint="Switch File List/Tree View">
				<span class="switch-file-list-btn-to-list">
					<span class="ty-icon ty-three-cells"></span>
				</span>
				<span class="switch-file-list-btn-to-tree">
					<span class="ty-icon ty-file-tree"></span>
				</span>
			</div>
		</div>
	</div>
</div>

<div aria-hidden="true" id="typora-sidebar-resizer">
	<div class="typora-sidebar-resizer-bar"></div>
</div>

<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
	<symbol id="find-and-replace-icon-case" viewBox="0 0 20 16" fill-rule="evenodd">
		<path d="M10.919,13 L9.463,13 C9.29966585,13 9.16550052,12.9591671 9.0605,12.8775 C8.95549947,12.7958329 8.8796669,12.6943339 8.833,12.573 L8.077,10.508 L3.884,10.508 L3.128,12.573 C3.09066648,12.6803339 3.01716722,12.7783329 2.9075,12.867 C2.79783279,12.9556671 2.66366746,13 2.505,13 L1.042,13 L5.018,2.878 L6.943,2.878 L10.919,13 Z M4.367,9.178 L7.594,9.178 L6.362,5.811 C6.30599972,5.66166592 6.24416701,5.48550102 6.1765,5.2825 C6.108833,5.07949898 6.04233366,4.85900119 5.977,4.621 C5.91166634,4.85900119 5.84750032,5.08066564 5.7845,5.286 C5.72149969,5.49133436 5.65966697,5.67099923 5.599,5.825 L4.367,9.178 Z M18.892,13 L18.115,13 C17.9516658,13 17.8233338,12.9755002 17.73,12.9265 C17.6366662,12.8774998 17.5666669,12.7783341 17.52,12.629 L17.366,12.118 C17.1839991,12.2813341 17.0055009,12.4248327 16.8305,12.5485 C16.6554991,12.6721673 16.4746676,12.7759996 16.288,12.86 C16.1013324,12.9440004 15.903001,13.0069998 15.693,13.049 C15.4829989,13.0910002 15.2496679,13.112 14.993,13.112 C14.6896651,13.112 14.4096679,13.0711671 14.153,12.9895 C13.896332,12.9078329 13.6758342,12.7853342 13.4915,12.622 C13.3071657,12.4586658 13.1636672,12.2556679 13.061,12.013 C12.9583328,11.7703321 12.907,11.4880016 12.907,11.166 C12.907,10.895332 12.9781659,10.628168 13.1205,10.3645 C13.262834,10.100832 13.499665,9.8628344 13.831,9.6505 C14.162335,9.43816561 14.6033306,9.2620007 15.154,9.122 C15.7046694,8.9819993 16.3883292,8.90266676 17.205,8.884 L17.205,8.464 C17.205,7.98333093 17.103501,7.62750116 16.9005,7.3965 C16.697499,7.16549885 16.4023352,7.05 16.015,7.05 C15.7349986,7.05 15.5016676,7.08266634 15.315,7.148 C15.1283324,7.21333366 14.9661673,7.28683292 14.8285,7.3685 C14.6908326,7.45016707 14.5636672,7.52366634 14.447,7.589 C14.3303327,7.65433366 14.2020007,7.687 14.062,7.687 C13.9453327,7.687 13.8450004,7.65666697 13.761,7.596 C13.6769996,7.53533303 13.6093336,7.46066711 13.558,7.372 L13.243,6.819 C14.0690041,6.06299622 15.0653275,5.685 16.232,5.685 C16.6520021,5.685 17.0264983,5.75383264 17.3555,5.8915 C17.6845016,6.02916736 17.9633322,6.22049877 18.192,6.4655 C18.4206678,6.71050122 18.5944994,7.00333163 18.7135,7.344 C18.8325006,7.68466837 18.892,8.05799797 18.892,8.464 L18.892,13 Z M15.532,11.922 C15.7093342,11.922 15.8726659,11.9056668 16.022,11.873 C16.1713341,11.8403332 16.3124993,11.7913337 16.4455,11.726 C16.5785006,11.6606663 16.7068327,11.5801671 16.8305,11.4845 C16.9541673,11.3888329 17.0789993,11.2756673 17.205,11.145 L17.205,9.934 C16.7009975,9.95733345 16.279835,10.0004997 15.9415,10.0635 C15.603165,10.1265003 15.3313343,10.2069995 15.126,10.305 C14.9206656,10.4030005 14.7748337,10.5173327 14.6885,10.648 C14.6021662,10.7786673 14.559,10.9209992 14.559,11.075 C14.559,11.3783349 14.6488324,11.5953327 14.8285,11.726 C15.0081675,11.8566673 15.2426652,11.922 15.532,11.922 L15.532,11.922 Z"></path>
	</symbol>
	<symbol id="find-and-replace-icon-word" viewBox="0 0 20 16" fill-rule="evenodd">
		<rect opacity="0.6" x="1" y="3" width="2" height="6"></rect>
		<rect opacity="0.6" x="17" y="3" width="2" height="6"></rect>
		<rect x="6" y="3" width="2" height="6"></rect>
		<rect x="12" y="3" width="2" height="6"></rect>
		<rect x="9" y="3" width="2" height="6"></rect>
		<path d="M4.5,13 L15.5,13 L16,13 L16,12 L15.5,12 L4.5,12 L4,12 L4,13 L4.5,13 L4.5,13 Z"></path>
		<path d="M4,10.5 L4,12.5 L4,13 L5,13 L5,12.5 L5,10.5 L5,10 L4,10 L4,10.5 L4,10.5 Z"></path>
		<path d="M15,10.5 L15,12.5 L15,13 L16,13 L16,12.5 L16,10.5 L16,10 L15,10 L15,10.5 L15,10.5 Z"></path>
	</symbol>
	<symbol id="find-and-replace-icon-regexp" viewBox="0 0 20 16" fill-rule="evenodd">
		<path xmlns="http://www.w3.org/2000/svg" d="M1.62 10a13.63 13.63 0 0 0 .45 3.51A13.39 13.39 0 0 0 3.4 16.7a.91.91 0 0 1 .1.27.41.41 0 0 1 0 .21.38.38 0 0 1-.1.15l-.14.11-.83.5a14.89 14.89 0 0 1-1.11-2 13.62 13.62 0 0 1-.74-2 13.22 13.22 0 0 1-.42-2 16.4 16.4 0 0 1 0-4.14 13.22 13.22 0 0 1 .42-2 13.84 13.84 0 0 1 .74-2A14.94 14.94 0 0 1 2.4 2l.83.51.14.11a.4.4 0 0 1 .1.15.41.41 0 0 1 0 .21.93.93 0 0 1-.1.27A13.6 13.6 0 0 0 1.62 10zM5 13.51a1.53 1.53 0 0 1 .11-.59 1.5 1.5 0 0 1 .31-.48 1.5 1.5 0 0 1 1.65-.32 1.51 1.51 0 0 1 .8.8 1.47 1.47 0 0 1 .12.59 1.46 1.46 0 0 1-.12.59 1.56 1.56 0 0 1-.32.48 1.46 1.46 0 0 1-.48.32 1.57 1.57 0 0 1-1.18 0 1.4 1.4 0 0 1-.47-.32A1.5 1.5 0 0 1 5 13.51zm10.8-4.72l-.54.94-1.75-1-.34-.23a1.38 1.38 0 0 1-.27-.26A1.84 1.84 0 0 1 13 9v2h-1V9a2.16 2.16 0 0 1 .12-.76 1.82 1.82 0 0 1-.58.48l-1.74 1-.54-.94 1.73-1a2.25 2.25 0 0 1 .75-.29 1.77 1.77 0 0 1-.75-.28L9.2 6.2l.54-.94 1.75 1 .33.24a1.64 1.64 0 0 1 .27.27A2 2 0 0 1 12 6V4h1v2a2.93 2.93 0 0 1 0 .4 1.36 1.36 0 0 1-.1.36 2.24 2.24 0 0 1 .59-.49l1.74-1 .54.94-1.73 1-.36.18a1.29 1.29 0 0 1-.36.1 2.11 2.11 0 0 1 .36.1 2 2 0 0 1 .36.19zM18.37 10a13.65 13.65 0 0 0-.45-3.51 13.81 13.81 0 0 0-1.32-3.27.93.93 0 0 1-.1-.27.45.45 0 0 1 0-.21.36.36 0 0 1 .1-.15l.14-.11.86-.48a15.54 15.54 0 0 1 1.1 2 13.79 13.79 0 0 1 .74 2 13.18 13.18 0 0 1 .42 2 16.16 16.16 0 0 1 .14 2 16.21 16.21 0 0 1-.13 2 13.18 13.18 0 0 1-.42 2 13.57 13.57 0 0 1-.74 2 15.49 15.49 0 0 1-1.1 2l-.84-.5-.14-.11a.35.35 0 0 1-.1-.15.44.44 0 0 1 0-.21.91.91 0 0 1 .1-.27 13.62 13.62 0 0 0 1.31-3.23 13.69 13.69 0 0 0 .43-3.53z"/>
	</symbol>
</svg>

<!-- Typora 底部状态栏（footer.ty-footer）。对照 Typora index.html 逐字节复刻 DOM，
     window.css 已提供全部样式（footer 默认 display:none，body 加 .show-footer 才显示；
     #footer-word-count-info 明细面板由 body 的 .ty-show-word-count 控制）。
     本项目在 Windows 形态才加 .show-footer（macOS 走右上 titlebar 字数，footer 隐藏）。
     字数文本由 React FooterStatsPortal 通过 portal 写入，这里只放静态骨架。 -->
<footer class="stopselect ty-footer">
	<div class="footer-item footer-item-left footer-btn" id="outline-btn">
		<i class="ty-md-radio-button-off ion-icon"></i>
		<i class="ty-md-radio-button-on ion-icon" style="display:none"></i>
		<i class="ion-chevron-left ion-icon" style="display:none"></i>
	</div>
	<div class="footer-item footer-item-left footer-btn" id="footer-more-btn">
		<i class="ty-typora-icon ion-icon"></i>
	</div>
	<div class="footer-item footer-item-right footer-btn" id="footer-spell-check">
		<span class="footer-spell-check-label">English</span>
	</div>
	<div class="footer-item footer-item-right" id="footer-word-count">
		<span id="footer-word-count-label">0 Words</span>
		<span class="ty-word-count-expand"><i class="fa ion-code"></i></span>
	</div>
	<div id="footer-word-count-info" class="dropdown-menu">
		<div class="ty-footer-word-count-all">
			<table>
				<tr><td id="footer-word-count-td">0</td><td id="footer-word-count-label-cn">Words</td></tr>
				<tr><td id="footer-char-count-td">0</td><td id="footer-char-count-label-cn">Characters</td></tr>
				<tr><td id="footer-line-count-td">0</td><td id="footer-line-count-label-cn">Lines</td></tr>
				<tr><td id="footer-read-time-td">0</td><td id="footer-read-time-label-cn">Read Time (min)</td></tr>
			</table>
		</div>
		<div class="footer-word-count-info-line footer-word-count-selection"></div>
	</div>
</footer>
`

// 复刻 Typora index.html 末尾的 DOM 搬运脚本（1421-1426 行）：
// macOS 形态下把 #file-library-search-panel 的内容（输入框+选项按钮+close）从
// #file-library-search 内搬到 #ty-sidebar-search-tabs，使搜索框渲染在顶部 tab 区。
// 这必须在使用骨架后立即执行，Typora window.css 的 .ty-sidebar-search-panel 布局
// 才能在正确位置生效。
export function applySidebarSearchPanelRelocation(root: ParentNode = document): void {
  const sourcePanel = root.querySelector('#file-library-search-panel')
  const target = root.querySelector('#ty-sidebar-search-tabs')
  if (!sourcePanel || !target) {
    return
  }

  // 幂等：若已搬运过则跳过（避免 React 重渲染导致重复）。
  const sourceInput = sourcePanel.querySelector('#file-library-search-input')
  if (!sourceInput) {
    return
  }

  // 与 Typora 一致：remove 整个 panel，把 innerHTML 拼进 target。
  // 但我们要保留骨架里 #file-library-search 的结构完整性，所以采用「移动子节点」而非
  // 「整个 panel 搬走」——因为 Typora 之所以 remove 是因为它的 panel 容器后续不再用，
  // 而我们的 React 交互层仍需引用这些输入框 id。
  const moved = Array.from(sourcePanel.children)
  moved.forEach((child) => target.appendChild(child))
}
