/* Compact, shared home for cloud projects and portable backups. */
(() => {
  const sidebar = document.getElementById('workspaceTools');
  const host = document.createElement('div');
  host.id = 'ms-workspace-menu';
  if (sidebar) host.className = 'workspace-inline';
  const style = document.createElement('style');
  style.textContent = `
    #ms-workspace-menu{position:fixed;right:16px;bottom:16px;z-index:1000;font:14px/1.5 system-ui;color:#193629}
    #ms-workspace-menu *{box-sizing:border-box}
    #ms-workspace-menu .workspace-toggle{display:block;margin:0 0 0 auto;min-height:40px;padding:8px 15px;border:1px solid #bdccc3;border-radius:20px;background:#fff;color:#193629;font:600 14px system-ui;cursor:pointer;box-shadow:0 3px 14px #19362920}
    #ms-workspace-menu .workspace-content{position:absolute;right:0;bottom:50px;width:min(420px,calc(100vw - 32px));max-height:calc(100dvh - 100px);overflow:auto;overscroll-behavior:contain;padding:12px;background:#fff;border:1px solid #bdccc3;border-radius:12px;box-shadow:0 8px 32px #19362930}
    #ms-workspace-menu [hidden]{display:none!important}
    #ms-workspace-menu .workspace-content>details{margin:0!important;padding:12px!important;border:0!important;border-radius:6px!important;font:14px/1.5 system-ui!important}
    #ms-workspace-menu .workspace-content>details+details{margin-top:8px!important;border-top:1px solid #dce5df!important}
    #ms-workspace-menu summary{cursor:pointer;font-weight:600;list-style:disclosure-closed}
    #ms-workspace-menu details[open]>summary{list-style:disclosure-open}
    #ms-workspace-menu button,#ms-workspace-menu input,#ms-workspace-menu select{max-width:100%;font:inherit}
    #ms-workspace-menu .cloud-row>input,#ms-workspace-menu .cloud-row>select{width:100%;min-width:0}
    #ms-workspace-menu p{overflow-wrap:anywhere}
    #ms-workspace-menu :focus-visible{outline:2px solid #245e45;outline-offset:3px}
    #ms-workspace-menu.workspace-inline{position:static;font:inherit;color:var(--ink);}
    #ms-workspace-menu.workspace-inline .workspace-content{position:static;width:auto;max-height:none;overflow:visible;padding:0;background:transparent;border:0;border-radius:0;box-shadow:none;}
    #ms-workspace-menu.workspace-inline .workspace-content>details{margin:8px 0 0!important;padding:10px!important;border:1px solid var(--line)!important;border-radius:7px!important;background:var(--panel)!important;color:var(--ink);font:13px/1.5 Arial,Helvetica,sans-serif!important;}
    #ms-workspace-menu.workspace-inline summary{color:var(--accent);list-style-position:inside;}
    #ms-workspace-menu.workspace-inline button,#ms-workspace-menu.workspace-inline input,#ms-workspace-menu.workspace-inline select{background:var(--accent-soft);color:var(--ink);border-color:var(--line);font:inherit;min-width:0;}
    #ms-workspace-menu.workspace-inline button{white-space:normal;}
    #ms-workspace-menu.workspace-inline .cloud-row>input{background:var(--panel);}
    @media print{#ms-workspace-menu{display:none}}
  `;
  document.head.append(style);
  const content = document.createElement('div');
  content.id = 'ms-workspace-content';
  content.className = 'workspace-content';
  if (sidebar) {
    host.append(content);
    sidebar.append(host);
    window.MSWorkspaceMenu = {
      mount(panel, section) {
        panel.open = false;
        if (section === 'cloud') content.prepend(panel);
        else content.append(panel);
      }
    };
    return;
  }
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'workspace-toggle';
  toggle.textContent = '☰ Menu';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'ms-workspace-content');
  toggle.setAttribute('aria-label', 'Projects, presets and backup menu');
  content.hidden = true;
  const close = (restoreFocus = false) => {
    content.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) toggle.focus();
  };
  toggle.addEventListener('click', () => {
    content.hidden = !content.hidden;
    toggle.setAttribute('aria-expanded', String(!content.hidden));
  });
  host.addEventListener('keydown', event => {
    if (event.key === 'Escape') { close(true); event.stopPropagation(); }
  });
  document.addEventListener('click', event => {
    if (!host.contains(event.target)) close();
  });
  // Keep the trigger first in keyboard order, even though the panel opens above it.
  host.append(toggle, content);
  document.body.append(host);
  window.MSWorkspaceMenu = {
    mount(panel, section) {
      if (section === 'cloud') { panel.open = true; content.prepend(panel); }
      else content.append(panel);
    }
  };
})();
