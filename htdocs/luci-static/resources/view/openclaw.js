'use strict';
'require view';
'require dom';
'require ui';
'require uci';
'require fs';
'require poll';

var HELPER = '/usr/share/openclaw/luci-helper';

function callHelper(args) {
	return L.resolveDefault(fs.exec_direct(HELPER, args), '').then(function(res) {
		try { return JSON.parse(String(res).trim()); }
		catch(e) { return {}; }
	});
}

function fmtMem(kb) {
	kb = parseInt(kb) || 0;
	if (kb <= 0) return '-';
	if (kb >= 1048576) return (kb / 1048576).toFixed(1) + ' GB';
	if (kb >= 1024) return (kb / 1024).toFixed(1) + ' MB';
	return kb + ' KB';
}

/* ── Crayfish SVG Logo ── */
var LOGO_SVG = '<svg viewBox="0 0 64 68" width="44" height="47" style="vertical-align:middle">' +
	'<defs>' +
	'<radialGradient id="glow"><stop offset="0%" stop-color="#d44" stop-opacity=".4"/><stop offset="100%" stop-color="#d44" stop-opacity="0"/></radialGradient>' +
	'<radialGradient id="body-g" cx="45%" cy="40%"><stop offset="0%" stop-color="#e06050"/><stop offset="100%" stop-color="#b03828"/></radialGradient>' +
	'</defs>' +
	/* glow */
	'<ellipse cx="32" cy="36" rx="30" ry="28" fill="url(#glow)"/>' +
	/* body - one big round shape */
	'<ellipse cx="32" cy="33" rx="16" ry="20" fill="url(#body-g)"/>' +
	/* head merged */
	'<circle cx="32" cy="17" r="12" fill="#c84838"/>' +
	/* belly overlap */
	'<ellipse cx="32" cy="25" rx="13" ry="8" fill="#c04030"/>' +
	/* antennae - thin elegant curves */
	'<path d="M27 8 Q24 1 22 0" stroke="#a03020" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
	'<path d="M37 8 Q40 1 42 0" stroke="#a03020" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
	/* eyes - dark circle + teal iris + highlight */
	'<circle cx="26.5" cy="16" r="3.8" fill="#111a1a"/>' +
	'<circle cx="37.5" cy="16" r="3.8" fill="#111a1a"/>' +
	'<circle cx="27" cy="15.5" r="2.2" fill="#20b090"/>' +
	'<circle cx="38" cy="15.5" r="2.2" fill="#20b090"/>' +
	'<circle cx="27.8" cy="14.8" r=".8" fill="#fff" opacity=".9"/>' +
	'<circle cx="38.8" cy="14.8" r=".8" fill="#fff" opacity=".9"/>' +
	/* arms / claws - rounded bumps */
	'<ellipse cx="13" cy="28" rx="5.5" ry="6.5" fill="#c04838"/>' +
	'<ellipse cx="51" cy="28" rx="5.5" ry="6.5" fill="#c04838"/>' +
	/* legs */
	'<rect x="26.5" y="51" width="4" height="7" rx="2" fill="#a03020"/>' +
	'<rect x="33.5" y="51" width="4" height="7" rx="2" fill="#a03020"/>' +
	/* feet */
	'<rect x="25" y="56" width="6.5" height="3" rx="1.5" fill="#8a2818"/>' +
	'<rect x="32.5" y="56" width="6.5" height="3" rx="1.5" fill="#8a2818"/>' +
	'</svg>';

/* ── CSS ── */
var CSS = '\
*,*::before,*::after{box-sizing:border-box}\
#oc-app{max-width:1100px;margin:0 auto;padding:0 16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;width:100%}\
.oc-header{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);color:#fff;padding:18px 22px;border-radius:10px;margin-bottom:0;display:flex;align-items:center;gap:14px}\
.oc-header h2{margin:0;font-size:20px;font-weight:600}\
.oc-header .sub{font-size:12px;opacity:.8;margin-top:2px}\
.oc-header>*,.oc-header h2,.oc-header .sub{background:transparent!important;box-shadow:none!important;border:none!important;border-radius:0!important;padding:0!important;color:inherit!important;margin:0!important}\
.oc-tabs{display:flex;background:#f8f9fa;border-bottom:2px solid #e0e0e0;overflow-x:auto}\
.oc-tab{padding:11px 22px;font-size:13px;font-weight:500;color:#666;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .2s;white-space:nowrap;user-select:none}\
.oc-tab:hover{color:#0f3460;background:#e8edf5}\
.oc-tab.active{color:#0f3460;border-bottom-color:#0f3460;background:#fff}\
.oc-panel{display:none;padding:20px 0}\
.oc-panel.active{display:block}\
.oc-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}\
.oc-card{background:#fff;border:1px solid #e8eaed;border-radius:10px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.04)}\
.oc-card .lbl{font-size:11px;color:#888;letter-spacing:.3px}\
.oc-card .val{font-size:22px;font-weight:700;color:#333;margin-top:4px;line-height:1.2}\
.oc-card .val.sm{font-size:15px;font-weight:600}\
.oc-badge{display:inline-block;padding:3px 14px;border-radius:20px;font-size:12px;font-weight:600}\
.oc-badge-run{background:#e8f5e9;color:#2e7d32}\
.oc-badge-stop{background:#ffebee;color:#c62828}\
.oc-badge-start{background:#fff8e1;color:#f57f17}\
.oc-badge-off{background:#f5f5f5;color:#9e9e9e}\
.oc-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle}\
.oc-dot-g{background:#2e7d32}.oc-dot-r{background:#c62828}.oc-dot-y{background:#f57f17}.oc-dot-x{background:#9e9e9e}\
.oc-info{background:#fff;border:1px solid #e8eaed;border-radius:10px;padding:0;overflow:hidden;margin-bottom:20px}\
.oc-info-title{background:#f8f9fa;padding:12px 18px;font-size:13px;font-weight:600;color:#555;border-bottom:1px solid #e8eaed}\
.oc-info table{width:100%;border-collapse:collapse}\
.oc-info td{padding:8px 16px;font-size:13px;border-bottom:1px solid #f5f5f5}\
.oc-info tr:last-child td{border-bottom:none}\
.oc-info td:first-child{width:100px;color:#888;font-weight:500}\
.oc-info td:last-child{color:#333;word-break:break-all}\
.oc-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px}\
.oc-btn{padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:6px}\
.oc-btn:hover{filter:brightness(.93)}\
.oc-btn:active{transform:scale(.97)}\
.oc-btn:disabled{opacity:.5;cursor:not-allowed;transform:none;filter:none}\
.oc-btn-p{background:#0f3460;color:#fff}\
.oc-btn-s{background:#2e7d32;color:#fff}\
.oc-btn-d{background:#c62828;color:#fff}\
.oc-btn-g{background:#f5f5f5;color:#333;border:1px solid #ddd}\
.oc-log-wrap{margin-top:16px;display:none}\
.oc-log-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}\
.oc-log-hdr span{font-weight:600;font-size:13px;color:#555}\
.oc-log-st{font-size:12px}\
.oc-log{background:#1e1e2e;color:#cdd6f4;padding:14px 16px;border-radius:8px;font-family:Consolas,Monaco,"Courier New",monospace;font-size:12px;line-height:1.6;max-height:380px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;border:1px solid #313244}\
.oc-log-result{margin-top:10px;padding:12px 16px;border-radius:8px;font-size:13px}\
.oc-log-ok{background:#e8f5e9;border:1px solid #c8e6c9;color:#2e7d32}\
.oc-log-fail{background:#ffebee;border:1px solid #ffcdd2;color:#c62828}\
.oc-form{background:#fff;border:1px solid #e8eaed;border-radius:10px;overflow:hidden;margin-bottom:20px}\
.oc-form-title{background:#f8f9fa;padding:12px 18px;font-size:13px;font-weight:600;color:#555;border-bottom:1px solid #e8eaed}\
.oc-form-body{padding:6px 18px}\
.oc-form-row{display:flex;align-items:center;padding:12px 0;border-bottom:1px solid #f5f5f5}\
.oc-form-row:last-child{border-bottom:none}\
.oc-form-lbl{width:120px;font-size:13px;font-weight:500;color:#555;flex-shrink:0}\
.oc-form-ctl{flex:1;min-width:0}\
.oc-form-ctl input,.oc-form-ctl select{padding:7px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;width:100%;max-width:260px;outline:none;transition:border-color .2s}\
.oc-form-ctl input:focus,.oc-form-ctl select:focus{border-color:#0f3460}\
.oc-form-hint{font-size:11px;color:#999;margin-top:3px}\
.oc-iframe-wrap{border:2px solid #e0e0e0;border-radius:10px;overflow:hidden;margin-top:10px;background:#fafafa}\
.oc-iframe-wrap iframe{width:100%;height:650px;border:none;display:block}\
.oc-iframe-msg{padding:48px;text-align:center;color:#888;font-size:14px;line-height:1.8}\
.oc-iframe-msg .icon{font-size:36px;margin-bottom:12px}\
.oc-dialog-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.45);z-index:10000;display:flex;align-items:center;justify-content:center}\
.oc-dialog{background:#fff;border-radius:12px;padding:24px;max-width:440px;width:92%;box-shadow:0 8px 32px rgba(0,0,0,.2)}\
.oc-dialog h3{margin:0 0 16px;font-size:16px;color:#333}\
.oc-dialog-opt{padding:12px 14px;border:2px solid #e0e0e0;border-radius:8px;margin-bottom:10px;cursor:pointer;transition:all .2s}\
.oc-dialog-opt:hover{border-color:#7a9cc6}\
.oc-dialog-opt.sel{border-color:#0f3460;background:#e8edf5}\
.oc-dialog-opt strong{display:block;font-size:13px;color:#333}\
.oc-dialog-opt small{font-size:11px;color:#888;display:block;margin-top:3px}\
.oc-dialog-btns{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}\
.oc-switch{position:relative;display:inline-block;width:44px;height:24px}\
.oc-switch input{opacity:0;width:0;height:0}\
.oc-switch .slider{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:#ccc;border-radius:24px;transition:.3s}\
.oc-switch .slider:before{position:absolute;content:"";height:18px;width:18px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.3s}\
.oc-switch input:checked+.slider{background:#0f3460}\
.oc-switch input:checked+.slider:before{transform:translateX(20px)}\
.oc-more-wrap{position:relative;display:inline-block}\
.oc-more-menu{position:absolute;top:100%;right:0;margin-top:6px;background:#fff;border:1px solid #e0e0e0;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.12);min-width:190px;z-index:100;display:none;overflow:hidden;padding:4px 0}\
.oc-more-menu.open{display:block}\
.oc-more-item{display:flex;align-items:center;gap:8px;padding:10px 16px;font-size:13px;color:#333;cursor:pointer;border:none;background:none;width:100%;text-align:left;transition:background .12s}\
.oc-more-item:hover{background:#f5f7fa}\
.oc-more-item.danger{color:#c62828}\
.oc-more-item.danger:hover{background:#fff5f5}\
.oc-more-sep{height:1px;background:#eee;margin:4px 0}\
@media(max-width:768px){\
#oc-app{padding:0 10px;max-width:100%;overflow-x:hidden}\
.oc-tabs{max-width:100%}\
.oc-header{padding:14px 16px;gap:10px}\
.oc-header h2{font-size:16px}\
.oc-cards{grid-template-columns:repeat(2,1fr);gap:10px}\
.oc-card .val{font-size:17px}\
.oc-card .val.sm{font-size:13px}\
.oc-actions{gap:6px;flex-wrap:nowrap;max-width:100%;overflow:hidden}\
.oc-actions>*{flex:0 1 auto;min-width:0}\
.oc-actions .oc-btn{padding:7px 10px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;justify-content:center}\
.oc-form-row{flex-direction:column;align-items:stretch;gap:4px}\
.oc-form-lbl{width:auto}\
.oc-form-ctl input,.oc-form-ctl select{max-width:100%}\
.oc-iframe-wrap iframe{height:400px}\
.oc-info td:first-child{width:80px}\
}\
@media(max-width:420px){\
.oc-header{padding:12px 14px}\
.oc-header h2{font-size:15px}\
.oc-tab{padding:9px 14px;font-size:12px}\
.oc-btn{padding:6px 10px;font-size:12px}\
.oc-actions .oc-btn{padding:6px 8px;font-size:11px}\
.oc-info td{padding:7px 12px;font-size:12px}\
.oc-cards{gap:8px}\
.oc-card{padding:10px 12px}\
.oc-card .val{font-size:16px}\
.oc-iframe-wrap iframe{height:350px}\
}\
/* dark mode for ArgonTheme */\
#oc-app[data-dark] .oc-card,\
#oc-app[data-dark] .oc-info,\
#oc-app[data-dark] .oc-form,\
#oc-app[data-dark] .oc-dialog,\
#oc-app[data-dark] .oc-more-menu{background:#2a2a2a;border-color:#3c3c3c}\
#oc-app[data-dark] .oc-card .val,\
#oc-app[data-dark] .oc-info td:last-child,\
#oc-app[data-dark] .oc-more-item,\
#oc-app[data-dark] .oc-form-lbl,\
#oc-app[data-dark] .oc-dialog h3,\
#oc-app[data-dark] .oc-dialog-opt strong{color:#ccc}\
#oc-app[data-dark] .oc-info-title,\
#oc-app[data-dark] .oc-form-title{background:#333;color:#aaa;border-color:#3c3c3c}\
#oc-app[data-dark] .oc-tabs{background:#2a2a2a;border-color:#3c3c3c}\
#oc-app[data-dark] .oc-tab{color:#999}\
#oc-app[data-dark] .oc-tab.active{color:#a5b2ff;border-bottom-color:#a5b2ff;background:#1e1e1e}\
#oc-app[data-dark] .oc-tab:hover{color:#a5b2ff;background:#333}\
#oc-app[data-dark] .oc-btn-g{background:#333;color:#ccc;border-color:#555}\
#oc-app[data-dark] .oc-info td{border-color:#333}\
#oc-app[data-dark] .oc-info td:first-child{color:#999}\
#oc-app[data-dark] .oc-form-row{border-color:#333}\
#oc-app[data-dark] .oc-form-ctl input,\
#oc-app[data-dark] .oc-form-ctl select{background:#1e1e1e;color:#ccc;border-color:#3c3c3c}\
#oc-app[data-dark] .oc-card .lbl{color:#999}\
#oc-app[data-dark] .oc-more-item:hover{background:#333}\
#oc-app[data-dark] .oc-more-sep{background:#3c3c3c}\
#oc-app[data-dark] .oc-badge-off{background:#333;color:#999}\
#oc-app[data-dark] .oc-dialog-opt{border-color:#3c3c3c}\
#oc-app[data-dark] .oc-dialog-opt.sel{border-color:#a5b2ff;background:#2a2a3a}\
#oc-app[data-dark] .oc-iframe-wrap{border-color:#3c3c3c;background:#1e1e1e}\
#oc-app[data-dark] .oc-log-ok{background:#1a3a1a;border-color:#2a4a2a;color:#6dbb6d}\
#oc-app[data-dark] .oc-log-fail{background:#3a1a1a;border-color:#4a2a2a;color:#dd6666}\
';

return view.extend({

	load: function() {
		return Promise.all([
			uci.load('openclaw'),
			callHelper(['status'])
		]);
	},

	render: function(data) {
		var st = data[1] || {};
		this._st = st;
		this._setupTimer = null;
		this._upgradeTimer = null;
		this._tabEls = {};

		var contentEl = E('div', { 'id': 'oc-content' }, [
			this._overview(st),
			this._settings(),
			this._console(st),
			this._terminal(st)
		]);
		this._contentEl = contentEl;

		var app = E('div', { 'id': 'oc-app' }, [
			E('style', {}, [CSS]),
			this._header(),
			this._tabBar(),
			contentEl
		]);

		/* detect dark mode: ArgonTheme dark.css or system preference */
		var isDark = document.querySelector('link[href*="dark"]') !== null ||
			window.matchMedia('(prefers-color-scheme: dark)').matches;
		if (isDark) app.setAttribute('data-dark', '');

		this._switchTab('overview');
		poll.add(L.bind(this._poll, this), 5);

		document.addEventListener('click', function() {
			var m = document.getElementById('oc-more-menu');
			if (m) m.classList.remove('open');
		});

		return app;
	},

	/* ═══ Header ═══ */
	_header: function() {
		var h = E('div', { 'class': 'oc-header' });
		h.innerHTML = LOGO_SVG +
			'<div><h2>OpenClaw AI Gateway</h2>' +
			'<div class="sub">' + _('Intelligent AI routing on your OpenWrt router') + '</div></div>';
		return h;
	},

	/* ═══ Tabs ═══ */
	_tabBar: function() {
		var self = this;
		var tabs = [
			['overview', '📊 ' + _('Overview')],
			['settings', '⚙️ ' + _('Settings')],
			['console',  '🖥️ ' + _('Web Console')],
			['terminal', '⌨️ ' + _('Config Terminal')]
		];
		var bar = E('div', { 'class': 'oc-tabs' });
		tabs.forEach(function(t) {
			var el = E('div', {
				'class': 'oc-tab',
				'data-tab': t[0],
				'click': function() { self._switchTab(t[0]); }
			}, [t[1]]);
			self._tabEls[t[0]] = el;
			bar.appendChild(el);
		});
		return bar;
	},

	_switchTab: function(id) {
		var self = this;
		Object.keys(this._tabEls).forEach(function(k) {
			self._tabEls[k].classList.toggle('active', k === id);
		});
		var root = this._contentEl || document.getElementById('oc-content');
		if (root) {
			var panels = root.querySelectorAll('.oc-panel');
			if (panels) panels.forEach(function(p) {
				p.classList.toggle('active', p.getAttribute('data-panel') === id);
			});
		}
	},

	/* ═══ Overview Panel ═══ */
	_overview: function(st) {
		return E('div', { 'class': 'oc-panel', 'data-panel': 'overview' }, [
			/* Status Cards */
			E('div', { 'class': 'oc-cards' }, [
				this._card('status',  _('Service Status'), this._badge(st)),
				this._card('port',    _('Gateway Port'),   st.port || '18789', true),
				this._card('memory',  _('Memory'),         fmtMem(st.memory_kb), true),
				this._card('uptime',  _('Uptime'),         st.uptime || '-', true)
			]),
			/* Version Info */
			this._infoTable(st),
			/* Action Buttons */
			this._actionBtns(),
			/* Log Viewer */
			this._logViewer()
		]);
	},

	_card: function(id, label, valueHtml, small) {
		var c = E('div', { 'class': 'oc-card' }, [
			E('div', { 'class': 'lbl' }, [label]),
			E('div', { 'class': 'val' + (small ? ' sm' : ''), 'id': 'oc-c-' + id })
		]);
		if (typeof valueHtml === 'string' && valueHtml.indexOf('<') >= 0)
			c.querySelector('.val').innerHTML = valueHtml;
		else
			c.querySelector('.val').textContent = valueHtml || '-';
		return c;
	},

	_badge: function(st) {
		if (!st || !st.enabled) return '<span class="oc-badge oc-badge-off">' + _('Unknown') + '</span>';
		if (st.enabled !== '1') return '<span class="oc-badge oc-badge-off"><span class="oc-dot oc-dot-x"></span>' + _('Disabled') + '</span>';
		if (st.gateway_running) return '<span class="oc-badge oc-badge-run"><span class="oc-dot oc-dot-g"></span>' + _('Running') + '</span>';
		if (st.gateway_starting) return '<span class="oc-badge oc-badge-start"><span class="oc-dot oc-dot-y"></span>' + _('Starting') + '</span>';
		return '<span class="oc-badge oc-badge-stop"><span class="oc-dot oc-dot-r"></span>' + _('Stopped') + '</span>';
	},

	_infoTable: function(st) {
		var rows = [
			[_('Node.js'),      'oc-i-node',     st.node_version || _('Not installed')],
			[_('OpenClaw'),     'oc-i-oc',       st.oc_version || _('Not installed')],
			[_('Plugin'),       'oc-i-plugin',   st.plugin_version || '-'],
			[_('Active Model'), 'oc-i-model',    st.active_model || '-'],
			[_('Channels'),     'oc-i-channels', st.channels || '-'],
			[_('PID'),          'oc-i-pid',      st.pid || '-'],
			[_('Config PTY'),   'oc-i-pty',      st.pty_running ? '✅ ' + _('Running') + ' (:' + (st.pty_port || '18793') + ')' : '⏹ ' + _('Stopped')]
		];
		var tbody = E('tbody');
		rows.forEach(function(r) {
			tbody.appendChild(E('tr', {}, [
				E('td', {}, [r[0]]),
				E('td', { 'id': r[1] }, [r[2]])
			]));
		});
		return E('div', { 'class': 'oc-info' }, [
			E('div', { 'class': 'oc-info-title' }, [_('System Information')]),
			E('table', {}, [tbody])
		]);
	},

	_actionBtns: function() {
		var self = this;
		var wrap = E('div', { 'class': 'oc-actions' });

		wrap.appendChild(E('button', {
			'class': 'oc-btn oc-btn-s', 'id': 'oc-btn-start',
			'click': function() { self._svcCtl('start'); }
		}, ['▶ ' + _('Start')]));

		wrap.appendChild(E('button', {
			'class': 'oc-btn oc-btn-d', 'id': 'oc-btn-stop',
			'click': function() { self._svcCtl('stop'); }
		}, ['⏹ ' + _('Stop')]));

		var moreWrap = E('div', { 'class': 'oc-more-wrap' });
		moreWrap.appendChild(E('button', {
			'class': 'oc-btn oc-btn-g',
			'click': function(ev) {
				ev.stopPropagation();
				var m = document.getElementById('oc-more-menu');
				if (m) m.classList.toggle('open');
			}
		}, ['⋮ ' + _('More')]));

		moreWrap.appendChild(E('div', { 'class': 'oc-more-menu', 'id': 'oc-more-menu' }, [
			E('div', { 'class': 'oc-more-item', 'click': function() { self._closeMenu(); self._svcCtl('restart'); } }, ['🔄 ' + _('Restart')]),
			E('div', { 'class': 'oc-more-sep' }),
			E('div', { 'class': 'oc-more-item', 'click': function() { self._closeMenu(); self._showSetupDialog(); } }, ['📦 ' + _('Install Environment')]),
			E('div', { 'class': 'oc-more-item', 'id': 'oc-btn-update', 'click': function() { self._closeMenu(); self._checkUpdate(); } }, ['🔍 ' + _('Check Update')]),
			E('div', { 'class': 'oc-more-sep' }),
			E('div', { 'class': 'oc-more-item danger', 'click': function() { self._closeMenu(); self._uninstall(); } }, ['🗑️ ' + _('Uninstall')])
		]));

		wrap.appendChild(moreWrap);
		return wrap;
	},

	_closeMenu: function() {
		var m = document.getElementById('oc-more-menu');
		if (m) m.classList.remove('open');
	},

	_logViewer: function() {
		return E('div', { 'class': 'oc-log-wrap', 'id': 'oc-log-wrap' }, [
			E('div', { 'class': 'oc-log-hdr' }, [
				E('span', { 'id': 'oc-log-title' }, ['📋 ' + _('Log')]),
				E('span', { 'class': 'oc-log-st', 'id': 'oc-log-st' })
			]),
			E('pre', { 'class': 'oc-log', 'id': 'oc-log' }),
			E('div', { 'id': 'oc-log-result' })
		]);
	},

	/* ═══ Settings Panel ═══ */
	_settings: function() {
		var self = this;
		var enabled = uci.get('openclaw', 'main', 'enabled') === '1';
		var port = uci.get('openclaw', 'main', 'port') || '18789';
		var bind = uci.get('openclaw', 'main', 'bind') || 'lan';
		var ptyPort = uci.get('openclaw', 'main', 'pty_port') || '18793';

		return E('div', { 'class': 'oc-panel', 'data-panel': 'settings' }, [
			E('div', { 'class': 'oc-form' }, [
				E('div', { 'class': 'oc-form-title' }, [_('Basic Settings')]),
				E('div', { 'class': 'oc-form-body' }, [
					this._formRow(_('Enable Service'), this._toggle('oc-f-enabled', enabled)),
					this._formRow(_('Gateway Port'), this._input('oc-f-port', port, 'number', _('Default: 18789'))),
					this._formRow(_('Listen Interface'), this._select('oc-f-bind', bind, [
						['lan', 'LAN'],
						['loopback', 'Loopback'],
						['all', _('All Interfaces')]
					])),
					this._formRow(_('PTY Port'), this._input('oc-f-pty-port', ptyPort, 'number', _('Default: 18793')))
				])
			]),
			E('div', { 'class': 'oc-actions' }, [
				E('button', { 'class': 'oc-btn oc-btn-p', 'click': function() { self._saveSettings(); } }, ['💾 ' + _('Save & Apply')]),
				E('button', { 'class': 'oc-btn oc-btn-g', 'click': function() { location.reload(); } }, [_('Reset')])
			])
		]);
	},

	_formRow: function(label, control) {
		return E('div', { 'class': 'oc-form-row' }, [
			E('div', { 'class': 'oc-form-lbl' }, [label]),
			E('div', { 'class': 'oc-form-ctl' }, [control])
		]);
	},

	_toggle: function(id, checked) {
		var lbl = E('label', { 'class': 'oc-switch' });
		lbl.innerHTML = '<input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '><span class="slider"></span>';
		return lbl;
	},

	_input: function(id, value, type, hint) {
		var wrap = E('div');
		wrap.appendChild(E('input', { 'type': type || 'text', 'id': id, 'value': value }));
		if (hint) wrap.appendChild(E('div', { 'class': 'oc-form-hint' }, [hint]));
		return wrap;
	},

	_select: function(id, value, opts) {
		var sel = E('select', { 'id': id });
		opts.forEach(function(o) {
			var opt = E('option', { 'value': o[0] }, [o[1]]);
			if (o[0] === value) opt.setAttribute('selected', 'selected');
			sel.appendChild(opt);
		});
		return sel;
	},

	/* ═══ Console Panel ═══ */
	_console: function(st) {
		var self = this;
		var panel = E('div', { 'class': 'oc-panel', 'data-panel': 'console' });
		var container = E('div', { 'class': 'oc-iframe-wrap' });

		if (st.gateway_running) {
			var proto = window.location.protocol;
			var host = window.location.hostname;
			var url = proto + '//' + host + ':' + (st.port || '18789') + '/';

			container.appendChild(E('iframe', {
				'src': url,
				'id': 'oc-console-iframe',
				'allow': 'clipboard-read; clipboard-write',
				'loading': 'lazy'
			}));
		} else {
			container.innerHTML = '<div class="oc-iframe-msg">' +
				'<div class="icon">🖥️</div>' +
				'<div>' + _('Web console is not available.') + '</div>' +
				'<div style="margin-top:8px;font-size:12px;color:#aaa">' + _('Please start the OpenClaw service first.') + '</div></div>';
		}
		panel.appendChild(container);
		return panel;
	},

	/* ═══ Terminal Panel ═══ */
	_terminal: function(st) {
		var panel = E('div', { 'class': 'oc-panel', 'data-panel': 'terminal' });
		var container = E('div', { 'class': 'oc-iframe-wrap' });

		if (st.pty_running) {
			var proto = window.location.protocol;
			var host = window.location.hostname;
			var ptyPort = st.pty_port || '18793';
			var url = proto + '//' + host + ':' + ptyPort + '/';

			/* Load PTY token then build iframe */
			callHelper(['get_token']).then(function(tok) {
				if (tok && tok.pty_token)
					url += '?pty_token=' + encodeURIComponent(tok.pty_token);
				container.innerHTML = '';
				container.appendChild(E('iframe', {
					'src': url,
					'allow': 'clipboard-read; clipboard-write',
					'style': 'width:100%;height:650px;border:none;display:block',
					'loading': 'lazy'
				}));
			});
			container.innerHTML = '<div class="oc-iframe-msg">' +
				'<div class="icon">⏳</div>' +
				'<div>' + _('Connecting to config terminal...') + '</div></div>';
		} else {
			container.innerHTML = '<div class="oc-iframe-msg">' +
				'<div class="icon">⌨️</div>' +
				'<div>' + _('Config terminal is not running.') + '</div>' +
				'<div style="margin-top:8px;font-size:12px;color:#aaa">' + _('Please start the OpenClaw service first.') + '</div></div>';
		}
		panel.appendChild(container);
		return panel;
	},

	/* ═══ Status Polling ═══ */
	_poll: function() {
		var self = this;
		return callHelper(['status']).then(function(st) {
			self._st = st;
			self._updateDisplay(st);
		});
	},

	_updateDisplay: function(st) {
		var el;
		/* Status card */
		el = document.getElementById('oc-c-status');
		if (el) el.innerHTML = this._badge(st);
		/* Port */
		el = document.getElementById('oc-c-port');
		if (el) el.textContent = st.port || '18789';
		/* Memory */
		el = document.getElementById('oc-c-memory');
		if (el) el.textContent = fmtMem(st.memory_kb);
		/* Uptime */
		el = document.getElementById('oc-c-uptime');
		if (el) el.textContent = st.uptime || '-';
		/* Info rows */
		var map = {
			'oc-i-node': st.node_version || _('Not installed'),
			'oc-i-oc': st.oc_version || _('Not installed'),
			'oc-i-plugin': st.plugin_version || '-',
			'oc-i-model': st.active_model || '-',
			'oc-i-channels': st.channels || '-',
			'oc-i-pid': st.pid || '-',
			'oc-i-pty': st.pty_running ? '✅ ' + _('Running') + ' (:' + (st.pty_port || '18793') + ')' : '⏹ ' + _('Stopped')
		};
		Object.keys(map).forEach(function(id) {
			el = document.getElementById(id);
			if (el) el.textContent = map[id];
		});
		/* Button states */
		var startBtn = document.getElementById('oc-btn-start');
		var stopBtn = document.getElementById('oc-btn-stop');
		if (startBtn) startBtn.disabled = !!st.gateway_running;
		if (stopBtn) stopBtn.disabled = !st.gateway_running;
	},

	/* ═══ Service Control ═══ */
	_svcCtl: function(action) {
		var self = this;
		ui.showModal(_('Service Control'), [
			E('p', {}, [_('Executing: ') + action + '...']),
			E('div', { 'class': 'spinning' })
		]);
		return fs.exec('/etc/init.d/openclaw', [action]).then(function() {
			return new Promise(function(resolve) { window.setTimeout(resolve, 2500); });
		}).then(function() {
			return self._poll();
		}).then(function() {
			ui.hideModal();
		}).catch(function(e) {
			ui.hideModal();
			ui.addNotification(null, E('p', {}, [_('Error: ') + (e.message || e)]));
		});
	},

	/* ═══ Setup Dialog ═══ */
	_showSetupDialog: function() {
		var self = this;
		var choice = 'stable';

		var overlay = E('div', { 'class': 'oc-dialog-overlay', 'id': 'oc-setup-dlg' });
		var dlg = E('div', { 'class': 'oc-dialog' }, [
			E('h3', {}, ['📦 ' + _('Choose Installation Version')]),
			E('div', {
				'class': 'oc-dialog-opt sel', 'id': 'oc-opt-stable',
				'click': function() { choice = 'stable'; self._selOpt('stable'); }
			}, [
				E('strong', {}, ['✅ ' + _('Stable (Recommended)')]),
				E('small', {}, [_('Tested and verified for compatibility')])
			]),
			E('div', {
				'class': 'oc-dialog-opt', 'id': 'oc-opt-latest',
				'click': function() { choice = 'latest'; self._selOpt('latest'); }
			}, [
				E('strong', {}, ['🆕 ' + _('Latest')]),
				E('small', {}, ['⚠️ ' + _('Latest npm release, may have untested issues')])
			]),
			E('div', { 'class': 'oc-dialog-btns' }, [
				E('button', { 'class': 'oc-btn oc-btn-g', 'click': function() { overlay.remove(); } }, [_('Cancel')]),
				E('button', { 'class': 'oc-btn oc-btn-p', 'click': function() { overlay.remove(); self._doSetup(choice); } }, [_('Install')])
			])
		]);
		overlay.appendChild(dlg);
		document.body.appendChild(overlay);
	},

	_selOpt: function(which) {
		var stable = document.getElementById('oc-opt-stable');
		var latest = document.getElementById('oc-opt-latest');
		if (stable) stable.classList.toggle('sel', which === 'stable');
		if (latest) latest.classList.toggle('sel', which === 'latest');
	},

	_doSetup: function(version) {
		var self = this;
		var logWrap = document.getElementById('oc-log-wrap');
		var logEl = document.getElementById('oc-log');
		var stEl = document.getElementById('oc-log-st');
		var resultEl = document.getElementById('oc-log-result');

		if (logWrap) logWrap.style.display = 'block';
		if (logEl) logEl.textContent = _('Starting installation') + ' (' + version + ')...\n';
		if (stEl) stEl.innerHTML = '<span style="color:#1565c0">⏳ ' + _('Installing...') + '</span>';
		if (resultEl) { resultEl.innerHTML = ''; resultEl.className = ''; }

		callHelper(['setup', version]).then(function() {
			self._pollSetupLog();
		});
	},

	_pollSetupLog: function() {
		var self = this;
		var lastLen = 0;
		if (this._setupTimer) clearInterval(this._setupTimer);

		this._setupTimer = setInterval(function() {
			callHelper(['setup_log']).then(function(r) {
				var logEl = document.getElementById('oc-log');
				var stEl = document.getElementById('oc-log-st');
				var resultEl = document.getElementById('oc-log-result');
				if (!logEl) return;

				if (r.log && r.log.length > lastLen) {
					logEl.textContent += r.log.substring(lastLen);
					lastLen = r.log.length;
				}
				logEl.scrollTop = logEl.scrollHeight;

				if (r.state === 'running') {
					if (stEl) stEl.innerHTML = '<span style="color:#1565c0">⏳ ' + _('Installing...') + '</span>';
				} else if (r.state === 'success') {
					clearInterval(self._setupTimer);
					if (stEl) stEl.innerHTML = '<span style="color:#2e7d32">✅ ' + _('Complete') + '</span>';
					if (resultEl) {
						resultEl.className = 'oc-log-result oc-log-ok';
						resultEl.innerHTML = '<strong>🎉 ' + _('Installation successful!') + '</strong><br>' +
							'<span style="font-size:12px">' + _('Refresh the page to see updated status.') + '</span>' +
							'<br><button class="oc-btn oc-btn-p" style="margin-top:10px" onclick="location.reload()">🔄 ' + _('Refresh') + '</button>';
					}
				} else if (r.state === 'failed') {
					clearInterval(self._setupTimer);
					if (stEl) stEl.innerHTML = '<span style="color:#c62828">❌ ' + _('Failed') + '</span>';
					if (resultEl) {
						resultEl.className = 'oc-log-result oc-log-fail';
						resultEl.textContent = '❌ ' + _('Installation failed. Check the log above for details.');
					}
				}
			});
		}, 1500);
	},

	/* ═══ Check Update ═══ */
	_checkUpdate: function() {
		var self = this;
		var btn = document.getElementById('oc-btn-update');
		if (btn) { btn.disabled = true; btn.textContent = '🔍 ' + _('Checking...'); }

		callHelper(['check_update']).then(function(r) {
			if (btn) { btn.disabled = false; btn.textContent = '🔍 ' + _('Check Update'); }
			if (r.plugin_has_update) {
				ui.showModal(_('Update Available'), [
					E('p', {}, [_('Current: ') + (r.plugin_current || '-')]),
					E('p', {}, [_('Latest: ') + (r.plugin_latest || '-')]),
					r.release_notes ? E('pre', { 'style': 'max-height:200px;overflow:auto;font-size:12px;background:#f5f5f5;padding:12px;border-radius:6px' }, [r.release_notes]) : E('span'),
					E('div', { 'style': 'display:flex;gap:10px;justify-content:flex-end;margin-top:16px' }, [
						E('button', { 'class': 'oc-btn oc-btn-g', 'click': ui.hideModal }, [_('Later')]),
						E('button', { 'class': 'oc-btn oc-btn-p', 'click': function() { ui.hideModal(); self._doUpgrade(r.plugin_latest); } }, ['⬆️ ' + _('Upgrade')])
					])
				]);
			} else {
				ui.addNotification(null, E('p', {}, ['✅ ' + _('Already up to date')]));
			}
		});
	},

	_doUpgrade: function(version) {
		var self = this;
		var logWrap = document.getElementById('oc-log-wrap');
		var logEl = document.getElementById('oc-log');
		var stEl = document.getElementById('oc-log-st');
		if (logWrap) logWrap.style.display = 'block';
		if (logEl) logEl.textContent = _('Upgrading to ') + version + '...\n';
		if (stEl) stEl.innerHTML = '<span style="color:#1565c0">⏳ ' + _('Upgrading...') + '</span>';

		callHelper(['plugin_upgrade', version]).then(function() {
			self._pollUpgradeLog();
		});
	},

	_pollUpgradeLog: function() {
		var self = this;
		var lastLen = 0;
		if (this._upgradeTimer) clearInterval(this._upgradeTimer);

		this._upgradeTimer = setInterval(function() {
			callHelper(['plugin_upgrade_log']).then(function(r) {
				var logEl = document.getElementById('oc-log');
				var stEl = document.getElementById('oc-log-st');
				var resultEl = document.getElementById('oc-log-result');
				if (!logEl) return;
				if (r.log && r.log.length > lastLen) {
					logEl.textContent += r.log.substring(lastLen);
					lastLen = r.log.length;
				}
				logEl.scrollTop = logEl.scrollHeight;
				if (r.state === 'success') {
					clearInterval(self._upgradeTimer);
					if (stEl) stEl.innerHTML = '<span style="color:#2e7d32">✅ ' + _('Upgrade complete') + '</span>';
					if (resultEl) {
						resultEl.className = 'oc-log-result oc-log-ok';
						resultEl.innerHTML = '<strong>🎉 ' + _('Upgrade successful!') + '</strong>' +
							'<br><button class="oc-btn oc-btn-p" style="margin-top:10px" onclick="location.reload()">🔄 ' + _('Refresh') + '</button>';
					}
				} else if (r.state === 'failed') {
					clearInterval(self._upgradeTimer);
					if (stEl) stEl.innerHTML = '<span style="color:#c62828">❌ ' + _('Failed') + '</span>';
				}
			});
		}, 1500);
	},

	/* ═══ Uninstall ═══ */
	_uninstall: function() {
		var self = this;
		ui.showModal(_('Confirm Uninstall'), [
			E('p', { 'style': 'color:#c62828' }, [
				'⚠️ ' + _('This will remove Node.js, OpenClaw runtime, and all related data.')
			]),
			E('p', {}, [_('This action cannot be undone.')]),
			E('div', { 'style': 'display:flex;gap:10px;justify-content:flex-end;margin-top:16px' }, [
				E('button', { 'class': 'oc-btn oc-btn-g', 'click': ui.hideModal }, [_('Cancel')]),
				E('button', { 'class': 'oc-btn oc-btn-d', 'click': function() {
					ui.hideModal();
					ui.showModal(_('Uninstalling...'), [E('div', { 'class': 'spinning' })]);
					callHelper(['uninstall']).then(function() {
						ui.hideModal();
						ui.addNotification(null, E('p', {}, ['✅ ' + _('Environment uninstalled successfully')]));
						return self._poll();
					});
				} }, ['🗑️ ' + _('Confirm Uninstall')])
			])
		]);
	},

	/* ═══ Save Settings ═══ */
	_saveSettings: function() {
		var self = this;
		var enabled = document.getElementById('oc-f-enabled');
		var port = document.getElementById('oc-f-port');
		var bind = document.getElementById('oc-f-bind');
		var ptyPort = document.getElementById('oc-f-pty-port');

		uci.set('openclaw', 'main', 'enabled', enabled && enabled.checked ? '1' : '0');
		if (port) uci.set('openclaw', 'main', 'port', port.value);
		if (bind) uci.set('openclaw', 'main', 'bind', bind.value);
		if (ptyPort) uci.set('openclaw', 'main', 'pty_port', ptyPort.value);

		return uci.save().then(function() {
			return uci.apply();
		}).then(function() {
			ui.addNotification(null, E('p', {}, ['✅ ' + _('Settings saved successfully')]));
			return self._poll();
		}).catch(function(e) {
			ui.addNotification(null, E('p', {}, [_('Error: ') + (e.message || e)]));
		});
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
