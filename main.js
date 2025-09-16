const { app, Tray, Menu, nativeImage, BrowserWindow, globalShortcut, screen, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');

let tray = null;
let config = null;
let settingsWindow = null;

// Настройки для проверки обновлений
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'lidarvision', // Замените на ваш GitHub username
  repo: 'trayway' // Замените на название вашего репозитория
});

// Настройки обновлений
autoUpdater.autoDownload = false; // Не скачивать автоматически
autoUpdater.autoInstallOnAppQuit = true; // Устанавливать при выходе

// Для разработки - принудительная проверка обновлений
if (process.env.NODE_ENV === 'development') {
  autoUpdater.forceDevUpdateConfig = true;
}

// Общая конфигурация по умолчанию
const DEFAULT_CONFIG = {
  folders: [
    {
      label: "Finder",
      path: "/"
    }
  ],
  sites: [
    {
      label: "Google",
      url: "https://google.com",
      type: "site"
    }
  ],
  trayEmoji: "😊",
  appName: "TrayWay",
  useExternalBrowser: true, // Всегда используем внешний браузер
  allowIconChange: true, // Включаем замену иконки по умолчанию
  showClock: false,
  firstRun: true, // Флаг первого запуска
  autoStart: false // Автозапуск
};

// Создание папки icons если её нет
function ensureIconsDirectory() {
  try {
    const iconsDir = path.join(__dirname, 'icons');
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
      console.log('Создана папка icons');
    }
  } catch (error) {
    console.error('Ошибка создания папки icons:', error);
  }
}

// Очистка старых иконок низкого разрешения
function cleanupOldLowResIcons() {
  try {
    const iconsDir = path.join(__dirname, 'icons');
    if (fs.existsSync(iconsDir)) {
      const files = fs.readdirSync(iconsDir);
      // Удаляем старые иконки с префиксом emoji-icon- (старый формат 24x24)
      const oldIcons = files.filter(file => file.startsWith('emoji-icon-') && file.endsWith('.png'));
      
      oldIcons.forEach(file => {
        const filePath = path.join(iconsDir, file);
        fs.unlinkSync(filePath);
        console.log('Удалена старая иконка низкого разрешения:', file);
      });
      
      // Также удаляем старые иконки с префиксом emoji- (если они были созданы в старом формате)
      const emojiIcons = files.filter(file => file.startsWith('emoji-') && file.endsWith('.png'));
      
      emojiIcons.forEach(file => {
        const filePath = path.join(iconsDir, file);
        // Проверяем размер файла - если он маленький, значит это старая иконка низкого разрешения
        const stats = fs.statSync(filePath);
        if (stats.size < 2000) { // Старые иконки 24x24 обычно меньше 2KB
          fs.unlinkSync(filePath);
          console.log('Удалена старая иконка низкого разрешения:', file);
        }
      });
    }
  } catch (error) {
    console.error('Ошибка очистки старых иконок:', error);
  }
}

// Загрузка конфигурации
function loadConfig() {
  try {
    // Создаем папку icons если её нет
    ensureIconsDirectory();
    
    // Очищаем старые иконки низкого разрешения
    cleanupOldLowResIcons();
    
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // Загружаем конфигурацию из файла с значениями по умолчанию
      config = {
        ...DEFAULT_CONFIG,
        ...configData,
        // Устанавливаем значения по умолчанию для новых полей
        allowIconChange: configData.allowIconChange !== undefined ? configData.allowIconChange : true,
        showClock: configData.showClock || false,
        firstRun: configData.firstRun !== undefined ? configData.firstRun : true,
        autoStart: configData.autoStart || false
      };
      
      // Проверяем реальное состояние автозапуска в системе
      if (configData.autoStart !== undefined) {
        const realAutoStart = isAutoStartEnabled();
        if (realAutoStart !== configData.autoStart) {
          console.log('Синхронизируем состояние автозапуска с системой');
          config.autoStart = realAutoStart;
        }
      }
      
      // Фильтруем папки с пустыми путями
      config.folders = config.folders.filter(folder => folder.path && folder.path.trim() !== '');
      
      console.log('Загружена конфигурация:', config);
    } else {
      // Конфигурация по умолчанию
      config = { ...DEFAULT_CONFIG };
      console.log('Создана конфигурация по умолчанию:', config);
    }
    
    // Проверяем и создаем иконку смайлика если нужно
    ensureEmojiIconExists();
    
  } catch (error) {
    console.error('Ошибка загрузки конфигурации:', error);
    // Используем конфигурацию по умолчанию
    config = { ...DEFAULT_CONFIG };
    console.log('Создана конфигурация по умолчанию после ошибки:', config);
  }
}

// Создаем высококачественную PNG иконку без масштабирования для сохранения
function createHighResEmojiPNG(emoji) {
  console.log('createHighResEmojiPNG: создаю высококачественную PNG иконку для смайлика:', emoji);
  
  try {
    const { createCanvas } = require('canvas');
    
    // Создаем canvas высокого разрешения 64x64 пикселя для четкости
    const canvas = createCanvas(64, 64);
    const ctx = canvas.getContext('2d');
    
    // Включаем сглаживание для лучшего качества
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Не заливаем фон - оставляем прозрачным
    // ctx.fillStyle = 'white';
    // ctx.fillRect(0, 0, 64, 64);
    
    // Устанавливаем шрифт для смайлика (большой размер для четкости)
    ctx.font = 'bold 48px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Добавляем небольшую тень для четкости
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 1;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    // Рисуем смайлик строго по центру по горизонтали и с смещением вниз для компенсации пустого пространства
    ctx.fillText(emoji, 32, 38);
    
    // Конвертируем canvas в PNG buffer
    const buffer = canvas.toBuffer('image/png');
    console.log('createHighResEmojiPNG: высококачественный PNG buffer создан, размер:', buffer.length);
    
    return buffer;
  } catch (error) {
    console.error('Ошибка создания высококачественной PNG иконки:', error);
    return null;
  }
}

// Проверяем и создаем высококачественную иконку смайлика если она не существует
function ensureEmojiIconExists() {
  if (config.allowIconChange && config.trayEmoji) {
    const iconPath = path.join(__dirname, 'icons', `emoji-${config.trayEmoji}.png`);
    
    // Проверяем, существует ли файл и не является ли он старой иконкой низкого разрешения
    let needsUpdate = false;
    if (fs.existsSync(iconPath)) {
      const stats = fs.statSync(iconPath);
      if (stats.size < 2000) { // Старые иконки 24x24 обычно меньше 2KB
        console.log('Найдена старая иконка низкого разрешения, пересоздаю:', config.trayEmoji);
        fs.unlinkSync(iconPath);
        needsUpdate = true;
      }
    } else {
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      console.log('Создаю высококачественную иконку смайлика:', config.trayEmoji);
      try {
        const buffer = createHighResEmojiPNG(config.trayEmoji);
        if (buffer) {
          fs.writeFileSync(iconPath, buffer);
          config.trayEmojiIcon = iconPath;
          console.log('Высококачественная иконка смайлика создана:', iconPath);
        } else {
          console.error('Не удалось создать буфер PNG для смайлика:', config.trayEmoji);
        }
      } catch (error) {
        console.error('Ошибка создания высококачественной иконки смайлика:', error);
      }
    } else {
      config.trayEmojiIcon = iconPath;
      console.log('Высококачественная иконка смайлика найдена:', iconPath);
    }
  }
}

function openSiteInTab(site) {
  // Если это приложение - открываем его
  if (site.type === 'app') {
    require('electron').shell.openPath(site.url);
    return;
  }
  
  // Всегда открываем сайты во внешнем браузере
  require('electron').shell.openExternal(site.url);
}


function buildContextMenu() {
  const menuItems = [];
  
  console.log('Создаю меню трея с конфигурацией:', config);
  
  // Добавляем папки, если они есть
  if (config.folders && config.folders.length > 0) {
    console.log('Добавляю папки в меню:', config.folders);
    config.folders.forEach(folder => {
      if (folder.label && folder.path) {
        menuItems.push({
          label: folder.label,
          click: () => require('electron').shell.openPath(folder.path)
        });
        console.log('Добавлена папка в меню:', folder.label, folder.path);
      } else {
        console.log('Пропускаю папку с пустыми данными:', folder);
      }
    });
    
    if (menuItems.length > 0) {
      menuItems.push({ type: 'separator' });
    }
  } else {
    console.log('Папки не найдены в конфигурации');
  }
  
  // Добавляем сайты
  if (config.sites && config.sites.length > 0) {
    console.log('Добавляю сайты в меню:', config.sites);
    config.sites.forEach(site => {
      if (site.label && site.url) {
        menuItems.push({
          label: site.label,
          click: () => openSiteInTab(site)
        });
      }
    });
    
    if (menuItems.length > 0) {
      menuItems.push({ type: 'separator' });
    }
  }
  
  // Добавляем настройки
  menuItems.push({ type: 'separator' });
  menuItems.push({
    label: 'Настройки',
    click: () => openSettingsWindow()
  });
  
  // Добавляем кнопку выхода
  menuItems.push({
    label: 'Выйти',
    click: () => {
      const { dialog } = require('electron');
      const result = dialog.showMessageBoxSync(null, {
        type: 'question',
        buttons: ['Отмена', 'Выйти'],
        defaultId: 1,
        title: 'Выход из TrayWay',
        message: 'Закрыть TrayWay?',
        detail: 'Приложение будет полностью завершено.',
        icon: path.join(__dirname, 'icon.png')
      });
      
      if (result === 1) {
        app.quit();
      }
    }
  });
  
  console.log('Итоговое меню трея:', menuItems);
  return Menu.buildFromTemplate(menuItems);
}

// Получаем оптимальный размер трея для текущей платформы
function getTrayIconSize() {
  if (process.platform === 'darwin') {
    return 22; // macOS трей обычно 22x22
  } else if (process.platform === 'win32') {
    return 16; // Windows трей обычно 16x16
  } else {
    return 24; // Linux трей обычно 24x24
  }
}

// Функция для создания иконки трея из смайлика
function createEmojiIcon(emoji) {
  console.log('createEmojiIcon: создаю высококачественную PNG иконку для смайлика:', emoji);
  
  try {
    const { createCanvas } = require('canvas');
    
    // Создаем canvas высокого разрешения 64x64 пикселя для четкости
    const canvas = createCanvas(64, 64);
    const ctx = canvas.getContext('2d');
    
    // Включаем сглаживание для лучшего качества
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Не заливаем фон - оставляем прозрачным
    // ctx.fillStyle = 'white';
    // ctx.fillRect(0, 0, 64, 64);
    
    // Устанавливаем шрифт для смайлика (большой размер для четкости)
    ctx.font = 'bold 48px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Добавляем небольшую тень для четкости
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 1;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    // Рисуем смайлик строго по центру по горизонтали и с смещением вниз для компенсации пустого пространства
    ctx.fillText(emoji, 32, 38);
    
    // Конвертируем canvas в PNG buffer
    const buffer = canvas.toBuffer('image/png');
    console.log('createEmojiIcon: высококачественный PNG buffer создан, размер:', buffer.length);
    
    // Создаем nativeImage из PNG buffer
    const icon = nativeImage.createFromBuffer(buffer);
    console.log('createEmojiIcon: nativeImage создан, isEmpty:', icon.isEmpty());
    
    // Масштабируем до размера трея
    const traySize = getTrayIconSize();
    const scaledIcon = icon.resize({ width: traySize, height: traySize });
    console.log('createEmojiIcon: иконка масштабирована до размера трея:', traySize + 'x' + traySize);
    
    return scaledIcon;
  } catch (error) {
    console.error('Ошибка создания высококачественной PNG иконки:', error);
    
    // Fallback к SVG если canvas не работает (размер трея)
    const traySize = getTrayIconSize();
    const fontSize = Math.floor(traySize * 0.75); // 75% от размера трея
    const svg = `<svg width="${traySize}" height="${traySize}" xmlns="http://www.w3.org/2000/svg">
      <text x="${traySize/2}" y="${traySize/2 + fontSize/4 + 2}" font-size="${fontSize}" font-weight="bold" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
    </svg>`;
    
    const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
    return nativeImage.createFromDataURL(dataUrl);
  }
}

// Функция updateTrayMenu больше не нужна, так как меню обновляется напрямую

function createTrayOnly() {
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  let trayIcon;
  
  console.log('createTrayOnly: allowIconChange =', config.allowIconChange, 'trayEmoji =', config.trayEmoji, 'trayEmojiIcon =', config.trayEmojiIcon);
  
  // Если включена замена иконки, НЕ выбран крестик и есть PNG иконка смайлика
  if (config.allowIconChange && config.trayEmoji !== '✕' && config.trayEmojiIcon && fs.existsSync(config.trayEmojiIcon)) {
    console.log('createTrayOnly: использую сохраненную высококачественную PNG иконку');
    const highResIcon = nativeImage.createFromPath(config.trayEmojiIcon);
    // Масштабируем до размера трея
    const traySize = getTrayIconSize();
    trayIcon = highResIcon.resize({ width: traySize, height: traySize });
    console.log('createTrayOnly: PNG иконка масштабирована до размера трея:', traySize + 'x' + traySize);
  } else if (config.allowIconChange && config.trayEmoji && config.trayEmoji !== '✕') {
    console.log('createTrayOnly: создаю высококачественную иконку из смайлика');
    trayIcon = createEmojiIcon(config.trayEmoji);
  } else {
    console.log('createTrayOnly: использую стандартную иконку (замена отключена или выбран крестик)');
    // Используем стандартную иконку
    let trayIconPath = path.join(__dirname, 'icon.svg');
    if (fs.existsSync(trayIconPath)) {
      trayIcon = nativeImage.createFromPath(trayIconPath);
    } else {
      const svg = `<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#1e90ff"/><text x="16" y="22" font-size="18" font-family="Arial" fill="#fff" text-anchor="middle" font-weight="bold">P</text></svg>`;
      trayIcon = nativeImage.createFromDataURL('data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'));
    }
  }
  
  tray = new Tray(trayIcon);
  
  console.log('Создан трей с высококачественной иконкой, устанавливаю меню с конфигурацией:', config);
  
  // Устанавливаем меню трея
  tray.setContextMenu(buildContextMenu());
  tray.setToolTip(config.appName || 'TrayWay');
  
  // Устанавливаем текст трея
  updateTrayText();
  
  // Запускаем часы если включены часы или батарея
  if (config.showClock || config.showBattery) {
    startClock();
  }
}

// Функция openRootTabWindow удалена - используем только внешний браузер

function openCustomMenuWindow(x, y) {
  const menuWin = new BrowserWindow({
    width: 1,
    height: 1,
    x: x,
    y: y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  menuWin.loadFile('menu.html');
  menuWin.once('ready-to-show', () => {
    // Отправляем актуальную конфигурацию в menu.html
    menuWin.webContents.send('config-updated', config);
    
    // Ждем полной загрузки содержимого перед показом
    menuWin.webContents.executeJavaScript(`
      // Ждем завершения рендеринга всех элементов
      setTimeout(() => {
        const contentHeight = document.body.scrollHeight;
        const contentWidth = document.body.scrollWidth;
        // Отправляем размеры в главный процесс
        require('electron').ipcRenderer.send('resize-menu-window', { width: contentWidth, height: contentHeight });
      }, 200); // Даем время на рендеринг всех элементов
    `);
    // Показываем окно только после изменения размера
    menuWin.once('resize', () => {
      menuWin.show();
    });
  });
  menuWin.on('blur', () => { if (!menuWin.isDestroyed()) menuWin.close(); });
}

function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  
  // Получаем позицию курсора для размещения окна
  const point = screen.getCursorScreenPoint();
  
  settingsWindow = new BrowserWindow({
    width: 500,
    height: 600,
    minWidth: 500,
    maxWidth: 500,
    minHeight: 600,
    maxHeight: 600,
    x: point.x - 250, // Центрируем относительно курсора
    y: point.y - 100,
    frame: true, // Обычная рамка macOS
    transparent: false, // Непрозрачное окно
    alwaysOnTop: false, // Не поверх всех окон
    resizable: false, // Фиксированный размер окна
    minimizable: true, // Можно сворачивать
    maximizable: false, // Нельзя разворачивать
    skipTaskbar: false, // Показывать в Dock
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: 'Настройки plusplus',
    icon: path.join(__dirname, 'icon.png')
  });
  
  settingsWindow.loadFile('settings.html');
  settingsWindow.once('ready-to-show', () => settingsWindow.show());
  
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function updateTrayText() {
  if (tray && process.platform === 'darwin') {
    // Если часы включены, не обновляем текст здесь - это делает updateTrayTime
    if (config.showClock) {
      return;
    }
    
    // Если замена иконки отключена, не показываем текст
    if (!config.allowIconChange) {
      tray.setTitle('');
      return;
    }
    
    // Показываем текст если он есть, независимо от того, какой смайлик выбран
    if (config.trayText && config.trayText.trim() !== '') {
      tray.setTitle(config.trayText.trim());
    } else {
      tray.setTitle('');
    }
  }
}

function updateTrayIcon() {
  if (tray) {
    let trayIcon;
    
    console.log('updateTrayIcon: allowIconChange =', config.allowIconChange, 'trayEmoji =', config.trayEmoji, 'trayEmojiIcon =', config.trayEmojiIcon);
    
    // Если включена замена иконки, НЕ выбран крестик и есть PNG иконка смайлика
    if (config.allowIconChange && config.trayEmoji !== '✕' && config.trayEmojiIcon && fs.existsSync(config.trayEmojiIcon)) {
      console.log('Использую сохраненную высококачественную PNG иконку:', config.trayEmojiIcon);
      const highResIcon = nativeImage.createFromPath(config.trayEmojiIcon);
      // Масштабируем до размера трея
      const traySize = getTrayIconSize();
      trayIcon = highResIcon.resize({ width: traySize, height: traySize });
      console.log('PNG иконка масштабирована до размера трея:', traySize + 'x' + traySize);
    } else if (config.allowIconChange && config.trayEmoji && config.trayEmoji !== '✕') {
      console.log('Создаю высококачественную иконку из смайлика:', config.trayEmoji);
      trayIcon = createEmojiIcon(config.trayEmoji);
    } else {
      console.log('Использую стандартную иконку (замена отключена или выбран крестик)');
      // Используем стандартную иконку
      let trayIconPath = path.join(__dirname, 'icon.svg');
      if (fs.existsSync(trayIconPath)) {
        trayIcon = nativeImage.createFromPath(trayIconPath);
      } else {
        const svg = `<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="16" fill="#1e90ff"/><text x="16" y="22" font-size="18" font-family="Arial" fill="#fff" text-anchor="middle" font-weight="bold">P</text></svg>`;
        trayIcon = nativeImage.createFromDataURL('data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'));
      }
    }
    
    console.log('Устанавливаю новую высококачественную иконку трея');
    tray.setImage(trayIcon);
    tray.setToolTip(config.appName || 'TrayWay');
    
    // Устанавливаем текст трея
    updateTrayText();
    
    // Также обновляем меню трея при изменении иконки
    tray.setContextMenu(buildContextMenu());
  } else {
    console.log('Трей не создан, пропускаю обновление иконки');
  }
}

// Обработчики IPC вынесены в отдельные функции
function setupIpcHandlers() {
  // Обработчик открытия сайта
  ipcMain.on('open-site', (event, site) => {
    console.log('ipcMain open-site', site);
    openSiteInTab(site);
  });
  
  // Обработчик внешнего браузера
  ipcMain.on('open-external-browser', (event, url) => {
    try {
      require('electron').shell.openExternal(url);
    } catch (error) {
      console.error('Error opening in external browser:', error);
    }
  });
  
  // Обработчик изменения размера окна меню
  ipcMain.on('resize-menu-window', (event, { width, height }) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      // Добавляем небольшой отступ для красоты
      const padding = 20;
      const maxHeight = 400; // Максимальная высота для активации прокрутки
      
      // Ограничиваем высоту до максимальной
      const finalHeight = Math.min(height, maxHeight);
      
      window.setSize(width + padding, finalHeight + padding);
    }
  });
  
  // Обработчик создания высококачественной PNG иконки из смайлика
  ipcMain.on('emoji-icon-created', (event, { emoji, dataURL }) => {
    console.log('Получена высококачественная PNG иконка для смайлика:', emoji);
    
    try {
      // Создаем папку icons если её нет
      ensureIconsDirectory();
      
      // Сохраняем высококачественную PNG иконку в папку icons
      const iconPath = path.join(__dirname, 'icons', `emoji-${emoji}.png`);
      
      // Конвертируем data URL в buffer
      const base64Data = dataURL.replace(/^data:image\/png;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Сохраняем файл
      fs.writeFileSync(iconPath, buffer);
      console.log('Высококачественная PNG иконка сохранена:', iconPath, 'размер:', buffer.length, 'байт');
      
      // Обновляем конфигурацию с путем к иконке
      config.trayEmojiIcon = iconPath;
      
      // Обновляем иконку трея
      updateTrayIcon();
      
    } catch (error) {
      console.error('Ошибка сохранения высококачественной PNG иконки:', error);
    }
  });

  // Обработчик обновления конфигурации
  ipcMain.on('config-updated', (event, newConfig) => {
    console.log('Получено обновление конфигурации:', newConfig);
    
    // Обновляем локальную конфигурацию новыми данными
    config = { ...config, ...newConfig };
    console.log('Обновленная конфигурация:', config);
    
    // Принудительно обновляем меню трея
    if (tray) {
      console.log('Обновляю меню трея с новой конфигурацией');
      tray.setContextMenu(buildContextMenu());
    }
    
    updateTrayIcon();
    
    // Управляем часами в зависимости от настройки
    if (config.showClock || config.showBattery) {
      startClock();
    } else {
      stopClock();
      // Возвращаем стандартную подсказку и обновляем текст трея
      if (tray) {
        tray.setToolTip(config.appName || 'TrayWay');
        updateTrayText();
      }
    }
  });
  
  // Обработчик обновления текста трея
  ipcMain.on('update-tray-text', (event, text) => {
    console.log('Обновление текста трея:', text);
    config.trayText = text;
    updateTrayText();
    
    // Если часы включены, принудительно обновляем время чтобы показать новый текст
    if (config.showClock && tray) {
      updateTrayTime();
    }
  });
  
  // Обработчик настройки автозапуска
  ipcMain.on('toggle-autostart', (event, enable) => {
    if (enable) {
      if (setupAutoStart()) {
        config.autoStart = true;
        saveConfig();
        event.sender.send('autostart-status', true);
      } else {
        event.sender.send('autostart-status', false);
      }
    } else {
      if (removeAutoStart()) {
        config.autoStart = false;
        saveConfig();
        event.sender.send('autostart-status', false);
      } else {
        event.sender.send('autostart-status', true);
      }
    }
  });
  
  // Обработчик запроса текущего состояния автозапуска
  ipcMain.on('get-autostart-status', (event) => {
    const currentStatus = isAutoStartEnabled();
    config.autoStart = currentStatus;
    event.sender.send('autostart-status', currentStatus);
  });
  
  // Обработчик открытия настроек
  ipcMain.on('open-settings', () => {
    openSettingsWindow();
  });
  
  // Обработчик сохранения конфигурации
  ipcMain.on('save-config', (event, newConfig) => {
    console.log('Получена конфигурация для сохранения:', newConfig);
    config = newConfig;
    saveConfig();
  });
  
  // Обработчик диалога подтверждения сброса настроек
  ipcMain.on('show-reset-confirm-dialog', async (event) => {
    const result = await dialog.showMessageBox({
      type: 'question',
      buttons: ['Отмена', 'Сбросить'],
      defaultId: 1,
      title: 'Сброс настроек',
      message: 'Сбросить все настройки к значениям по умолчанию?',
      detail: 'Все ваши настройки будут потеряны и восстановлены значения по умолчанию.',
      icon: path.join(__dirname, 'icon.png')
    });
    
    // Отправляем результат обратно в renderer
    event.sender.send('reset-confirm-result', result.response === 1);
  });
  
  // Обработчики для диалогов выбора файлов
  ipcMain.on('select-folder', async (event, inputId) => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Выберите папку'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      event.sender.send('folder-selected', { inputId, path: result.filePaths[0] });
    }
  });
  
  ipcMain.on('select-application', async (event, inputId) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      defaultPath: '/Applications',
      filters: [
        { name: 'Приложения', extensions: ['app'] }
      ],
      title: 'Выберите приложение из папки Applications'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      event.sender.send('application-selected', { inputId, path: result.filePaths[0] });
    }
  });
  
  ipcMain.on('select-file', async (event, { inputId, extension }) => {
    const filters = extension === 'conf' 
      ? [{ name: 'Конфигурационные файлы', extensions: ['conf', 'config', 'cfg'] }]
      : [{ name: 'Все файлы', extensions: ['*'] }];
      
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: filters,
      title: 'Выберите файл'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      event.sender.send('file-selected', { inputId, path: result.filePaths[0] });
    }
  });
  
  ipcMain.on('select-app-for-site', async (event, index) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      defaultPath: '/Applications',
      filters: [
        { name: 'Приложения', extensions: ['app'] }
      ],
      title: 'Выберите приложение из папки Applications'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      event.sender.send('app-for-site-selected', { index, path: result.filePaths[0] });
    }
  });
  
  ipcMain.on('select-folder-for-item', async (event, index) => {
    // Получаем текущий путь для этой папки
    let defaultPath = '';
    if (config && config.folders && config.folders[index]) {
      defaultPath = config.folders[index].path || '';
    }
    
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath: defaultPath,
      title: 'Выберите папку'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      event.sender.send('folder-for-item-selected', { index, path: result.filePaths[0] });
    }
  });
  
  // Обработчик проверки обновлений из настроек
  ipcMain.on('check-for-updates', (event) => {
    console.log('Проверка обновлений запрошена из настроек');
    autoUpdater.checkForUpdatesAndNotify();
    
    // Отправляем уведомление в настройки
    event.sender.send('update-check-started');
  });
  
  // Обработчик скачивания обновления
  ipcMain.on('download-update', (event) => {
    console.log('Скачивание обновления запрошено из настроек');
    autoUpdater.downloadUpdate();
    
    // Отправляем уведомление о начале скачивания
    event.sender.send('update-download-started');
  });
  
  // Обработчик перезапуска приложения
  ipcMain.on('restart-app', () => {
    console.log('Перезапуск приложения для установки обновления');
    autoUpdater.quitAndInstall();
  });
  
  // Обработчик обновления конфигурации в menu.html
  ipcMain.on('refresh-menu-config', (event) => {
    console.log('Обновление конфигурации в menu.html');
    // Перезагружаем конфигурацию
    loadConfig();
    // Отправляем обновленную конфигурацию в menu.html
    event.sender.send('config-updated', config);
  });
}

// Обработчики событий обновлений
function setupUpdateHandlers() {
  // Проверка доступности обновления
  autoUpdater.on('update-available', (info) => {
    console.log('Доступно обновление:', info.version);
    
    // Показываем уведомление пользователю
    if (tray) {
      tray.displayBalloon({
        iconType: 'info',
        title: 'Доступно обновление',
        content: `Доступна новая версия ${info.version}. Нажмите для скачивания.`,
        noSound: false
      });
    }
    
    // Отправляем уведомление в настройки
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('update-check-result', {
        available: true,
        version: info.version,
        message: `Доступна новая версия ${info.version}`
      });
    }
  });

  // Обновление недоступно
  autoUpdater.on('update-not-available', (info) => {
    console.log('Обновления нет:', info.version);
    
    // Отправляем уведомление в настройки
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('update-check-result', {
        available: false,
        message: 'У вас установлена последняя версия'
      });
    }
  });

  // Ошибка при проверке обновлений
  autoUpdater.on('error', (err) => {
    console.error('Ошибка при проверке обновлений:', err);
    
    // Отправляем уведомление об ошибке в настройки
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('update-check-result', {
        available: false,
        error: true,
        message: 'Ошибка при проверке обновлений: ' + err.message
      });
    }
  });

  // Скачивание обновления
  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Скорость скачивания: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Скачано ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    console.log(log_message);
    
    // Отправляем прогресс в настройки
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('update-download-progress', {
        percent: Math.round(progressObj.percent),
        message: `Скачано ${Math.round(progressObj.percent)}%`
      });
    }
  });

  // Обновление скачано
  autoUpdater.on('update-downloaded', (info) => {
    console.log('Обновление скачано:', info.version);
    
    // Отправляем уведомление в настройки
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('update-downloaded', info);
    }
    
    // Показываем диалог с предложением перезапустить
    const result = dialog.showMessageBoxSync(null, {
      type: 'info',
      buttons: ['Позже', 'Перезапустить сейчас'],
      defaultId: 1,
      title: 'Обновление готово',
      message: `Обновление до версии ${info.version} скачано.`,
      detail: 'Перезапустить приложение для применения обновления?',
      icon: path.join(__dirname, 'icon.png')
    });
    
    if (result === 1) {
      autoUpdater.quitAndInstall();
    }
  });

  // Проверяем обновления каждую неделю
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 7 * 24 * 60 * 60 * 1000); // 7 дней
}

app.whenReady().then(() => {
  loadConfig();
  createTrayOnly();
  
  // Принудительно обновляем меню трея после создания
  if (tray) {
    tray.setContextMenu(buildContextMenu());
  }

  globalShortcut.register('CommandOrControl+1', () => {
    const point = screen.getCursorScreenPoint();
    openCustomMenuWindow(point.x, point.y);
  });

  // Настраиваем все обработчики IPC
  setupIpcHandlers();
  
  // Настраиваем обработчики обновлений
  setupUpdateHandlers();
  
  // Показываем диалог первого запуска
  setTimeout(() => {
    showFirstRunDialog();
  }, 1000); // Небольшая задержка для полной инициализации
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (tray) {
    // If the tray icon exists, it means the app is running.
    // No need to create a new window here as the app is now only in the tray.
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Функции для работы с часами
let clockInterval = null;

function startClock() {
  if (clockInterval) {
    clearInterval(clockInterval);
  }
  
  clockInterval = setInterval(() => {
    if (tray && (config.showClock || config.showBattery)) {
      updateTrayTime();
    }
  }, 1000);
}

function stopClock() {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
}

function updateTrayTime() {
  if (!tray || (!config.showClock && !config.showBattery)) return;
  
  const now = new Date();
  
  // Получаем время в UTC+5 (Астана)
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const astanaTime = new Date(utcTime + (5 * 60 * 60 * 1000));
  
  let hours = astanaTime.getHours();
  const minutes = astanaTime.getMinutes();
  
  let timeString;
  if (config.use24HourFormat) {
    // 24-часовой формат
    timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  } else {
    // 12-часовой формат
    let displayHours = hours;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    if (hours > 12) {
      displayHours = hours - 12;
    } else if (hours === 0) {
      displayHours = 12;
    }
    
    if (config.showAmPm) {
      timeString = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    } else {
      timeString = `${displayHours}:${minutes.toString().padStart(2, '0')}`;
    }
  }
  
  // Получаем информацию о батарее
  const batteryInfo = getBatteryInfo();
  
  // Обновляем подсказку с текущим временем и батареей
  const dateString = now.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tashkent'
  });
  
  // Формируем подсказку в зависимости от включенных опций
  let tooltipParts = [];
  if (config.showClock) {
    tooltipParts.push(`Время: ${timeString}`);
  }
  if (config.showBattery) {
    tooltipParts.push(`Батарея: ${batteryInfo.percentage}%`);
  }
  tooltipParts.push(`Дата: ${dateString}`);
  
  tray.setToolTip(tooltipParts.join('\n'));
  
  // Для macOS обновляем заголовок иконки с батареей и временем
  if (process.platform === 'darwin') {
    let titleParts = [];
    
    if (config.allowIconChange && config.trayText && config.trayText.trim() !== '') {
      titleParts.push(config.trayText.trim());
    }
    
    if (config.showBattery) {
      titleParts.push(`${batteryInfo.percentage}%`);
    }
    
    if (config.showClock) {
      titleParts.push(timeString);
    }
    
    if (titleParts.length > 0) {
      tray.setTitle(titleParts.join(' • '));
    } else {
      tray.setTitle('');
    }
  }
}

function getBatteryInfo() {
  try {
    // Для macOS используем системные команды
    if (process.platform === 'darwin') {
      const { execSync } = require('child_process');
      const batteryInfo = execSync('pmset -g batt').toString();
      
      const percentageMatch = batteryInfo.match(/(\d+)%/);
      const isCharging = batteryInfo.includes('charging') && !batteryInfo.includes('discharging');
      const isPlugged = batteryInfo.includes('AC Power') || batteryInfo.includes('charging');
      
      if (percentageMatch) {
        const percentage = parseInt(percentageMatch[1]);
        return {
          percentage,
          isCharging,
          isPlugged
        };
      }
    }
    
    // Для других платформ возвращаем заглушку
    return {
      percentage: 100,
      isCharging: false,
      isPlugged: true
    };
  } catch (error) {
    return {
      percentage: 100,
      isCharging: false,
      isPlugged: true
    };
  }
}

// Функции для работы с автозапуском через Electron API (правильный способ)
function setupAutoStart() {
  try {
    // Используем стандартный Electron API для автозапуска
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true, // Запускаем скрыто (в трее)
      name: 'TrayWay'
    });
    
    console.log('Автозапуск настроен успешно через Electron API');
    return true;
  } catch (error) {
    console.error('Ошибка настройки автозапуска:', error);
    return false;
  }
}

function removeAutoStart() {
  try {
    // Отключаем автозапуск через Electron API
    app.setLoginItemSettings({
      openAtLogin: false,
      openAsHidden: false,
      name: 'TrayWay'
    });
    
    console.log('Автозапуск отключен через Electron API');
    return true;
  } catch (error) {
    console.error('Ошибка отключения автозапуска:', error);
    return false;
  }
}

function isAutoStartEnabled() {
  try {
    // Проверяем состояние автозапуска через Electron API
    const loginItemSettings = app.getLoginItemSettings();
    return loginItemSettings.openAtLogin;
  } catch (error) {
    console.error('Ошибка проверки автозапуска:', error);
    return false;
  }
}

function showFirstRunDialog() {
  if (!config.firstRun) return;
  
  const { dialog } = require('electron');
  
  const result = dialog.showMessageBoxSync(null, {
    type: 'question',
    buttons: ['Нет, спасибо', 'Да, запускать при старте'],
    defaultId: 1,
    title: 'Настройка автозапуска',
    message: 'Запускать TrayWay при старте macOS?',
    detail: 'Приложение будет автоматически запускаться при входе в систему и работать в фоновом режиме. Вы можете изменить это в настройках.',
    icon: path.join(__dirname, 'icon.png')
  });
  
  if (result === 1) {
    // Пользователь выбрал автозапуск
    if (setupAutoStart()) {
      config.autoStart = true;
      config.firstRun = false;
      saveConfig();
      
      dialog.showMessageBoxSync(null, {
        type: 'info',
        buttons: ['OK'],
        title: 'Автозапуск настроен',
        message: 'TrayWay будет запускаться при старте macOS',
        icon: path.join(__dirname, 'icon.png')
      });
    }
  } else {
    // Пользователь отказался
    config.firstRun = false;
    config.autoStart = false;
    saveConfig();
  }
}

function saveConfig() {
  try {
    const configPath = path.join(__dirname, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Конфигурация сохранена');
  } catch (error) {
    console.error('Ошибка сохранения конфигурации:', error);
  }
} 
