import { app, shell } from 'electron'

function getDefaultMenuTemplate(app: any, shell: any) {
  const isMac = process.platform === 'darwin';
  return [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' as const },
          { role: 'delete' as const },
          { role: 'selectAll' as const },
          { type: 'separator' as const },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' as const },
              { role: 'stopSpeaking' as const }
            ]
          }
        ] : [
          { role: 'delete' as const },
          { type: 'separator' as const },
          { role: 'selectAll' as const }
        ])
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'toggleFullscreen' as const }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
          { type: 'separator' as const },
          { role: 'window' as const }
        ] : [
          { role: 'close' as const }
        ])
      ]
    },
    {
      role: 'help' as const,
      submenu: [
        {
          label: 'Learn More',
          click: () => { shell.openExternal('https://electronjs.org'); }
        }
      ]
    }
  ];
}

// Define default menu (optionally append to)
export function createMenuTemplate(app: any, replace?: any) {
  // getDefaultMenuTemplate already ships exactly one File, Edit, View, Window
  // and Help entry. The old code re-spliced duplicate File/View menus at
  // hard-coded indices (which didn't account for the macOS app-name entry),
  // producing the "two View / two File" bars users saw. Build on top of the
  // default instead.
  const menu = getDefaultMenuTemplate(app, shell) as Array<any>;
  if (replace) {
    // During playback, put the Player controls where the View menu is.
    const viewIndex = menu.findIndex((m: any) => !!m && m.label === 'View');
    if (viewIndex >= 0) {
      menu.splice(viewIndex, 1, replace);
    }
  }
  return menu;
}

export function createMainMenu(menu: any, template: any) {
  menu.setApplicationMenu(menu.buildFromTemplate(template));
}