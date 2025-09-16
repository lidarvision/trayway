const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

let config = {};

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
  trayText: "", // Текст для отображения в трее
  useExternalBrowser: true, // Всегда используем внешний браузер
  allowIconChange: true, // Включаем замену иконки по умолчанию
  showClock: false,
  use24HourFormat: true, // По умолчанию используем 24-часовой формат
  showAmPm: true, // По умолчанию показываем AM/PM в 12-часовом формате
  showBattery: false,
  firstRun: true,
  autoStart: false
};

// Загрузка конфигурации при старте
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  setupEventListeners();
  
  // Запрашиваем текущее состояние автозапуска
  ipcRenderer.send('get-autostart-status');
});

function setupEventListeners() {
  // Обработчик выбора смайлика
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('emoji-item')) {
      selectEmoji(e.target.textContent);
    }
  });
  
  // Обработчик тумблера внешнего браузера удален - всегда используем внешний браузер

  // Обработчик тумблера замены иконки в трее
  document.getElementById('allowIconChange').addEventListener('change', (e) => {
    config.allowIconChange = e.target.checked;
    updateIconChangeState(e.target.checked);
    // Отправляем обновление конфигурации
    ipcRenderer.send('config-updated', config);
  });

  // Обработчик тумблера показа часов в трее
  document.getElementById('showClock').addEventListener('change', (e) => {
    config.showClock = e.target.checked;
    updateTimeFormatState(e.target.checked);
    // Отправляем обновление конфигурации
    ipcRenderer.send('config-updated', config);
  });

  // Обработчик тумблера формата времени удален - формат управляется через selectTimeFormat()

  // Обработчик тумблера показа AM/PM
  document.getElementById('showAmPm').addEventListener('change', (e) => {
    config.showAmPm = e.target.checked;
    // Отправляем обновление конфигурации
    ipcRenderer.send('config-updated', config);
  });

  // Обработчик тумблера показа заряда батареи в трее
  document.getElementById('showBattery').addEventListener('change', (e) => {
    config.showBattery = e.target.checked;
    // Отправляем обновление конфигурации
    ipcRenderer.send('config-updated', config);
  });
  
  // Обработчик тумблера автозапуска
  document.getElementById('autoStart').addEventListener('change', (e) => {
    const enable = e.target.checked;
    ipcRenderer.send('toggle-autostart', enable);
  });
  
  // Обработчик ответа о статусе автозапуска
  ipcRenderer.on('autostart-status', (event, enabled) => {
    config.autoStart = enabled;
    document.getElementById('autoStart').checked = enabled;
  });
  
  // Обработчик результата диалога подтверждения сброса настроек
  ipcRenderer.on('reset-confirm-result', (event, confirmed) => {
    if (confirmed) {
      config = { ...DEFAULT_CONFIG };
      
      // Сохраняем сброшенную конфигурацию
      ipcRenderer.send('save-config', config);
      
      populateForm();
      renderFolders();
      renderSites();
      showNotification('Настройки сброшены к значениям по умолчанию');
    }
  });
  
  // Обработчики для диалогов выбора файлов
  ipcRenderer.on('folder-selected', (event, { inputId, path }) => {
    document.getElementById(inputId).value = path;
  });
  
  ipcRenderer.on('application-selected', (event, { inputId, path }) => {
    document.getElementById(inputId).value = path;
  });
  
  ipcRenderer.on('file-selected', (event, { inputId, path }) => {
    document.getElementById(inputId).value = path;
  });
  
  ipcRenderer.on('app-for-site-selected', (event, { index, path }) => {
    config.sites[index].url = path;
    
    // Автоматически заполняем название приложения, если оно стандартное
    if (config.sites[index].label === 'Новое приложение') {
      const appName = path.split('/').pop().replace('.app', '');
      config.sites[index].label = appName;
    }
    
    renderSites();
    
    // Отправляем обновление конфигурации
    ipcRenderer.send('config-updated', config);
  });
  
  ipcRenderer.on('folder-for-item-selected', (event, { index, path }) => {
    config.folders[index].path = path;
    
    // Автоматически вставляем название папки, если оно не задано
    if (!config.folders[index].label || config.folders[index].label.trim() === '') {
      const folderName = path.split('/').pop(); // Получаем название папки из пути
      config.folders[index].label = folderName;
    }
    
    renderFolders();
    // Отправляем обновление в реальном времени
    ipcRenderer.send('config-updated', config);
  });
  
  // Глобальный обработчик кликов для скрытия подсказок и попапа смайликов
  document.addEventListener('click', function(event) {
    if (!event.target.classList.contains('help-icon')) {
      const allTooltips = document.querySelectorAll('.help-tooltip');
      allTooltips.forEach(tooltip => tooltip.classList.remove('show'));
    }
    
    // Закрываем попап смайликов при клике вне его
    const emojiPopup = document.getElementById('emojiPopup');
    if (emojiPopup && !emojiPopup.classList.contains('hidden')) {
      const popupContent = emojiPopup.querySelector('.emoji-popup-content');
      if (!popupContent.contains(event.target) && !event.target.closest('.icon-selector-row')) {
        closeEmojiPopup();
      }
    }
    
    // Обработчик для сохранения текста при клике вне поля ввода
    const textInput = document.getElementById('trayText');
    const saveBtn = document.getElementById('save-text-btn');
    if (textInput && saveBtn && saveBtn.style.display !== 'none') {
      if (!textInput.contains(event.target) && !saveBtn.contains(event.target)) {
        saveTrayText();
      }
    }
  });
}

// Функция переключения вкладок - простая
function showTab(tabName, event) {
  // Скрываем все вкладки
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(tab => tab.classList.remove('active'));
  
  // Убираем активный класс со всех кнопок
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => btn.classList.remove('active'));
  
  // Показываем выбранную вкладку
  document.getElementById(tabName + '-tab').classList.add('active');
  
  // Активируем соответствующую кнопку
  if (event) {
    event.target.classList.add('active');
  }
  
  // Если показываем основную вкладку, обновляем рендеринг
  if (tabName === 'main') {
    renderFolders();
    renderSites();
  }
}

// Функции для выбора файлов, папок и приложений
function selectFolder(inputId) {
  const { ipcRenderer } = require('electron');
  ipcRenderer.send('select-folder', inputId);
}

function selectApplication(inputId) {
  const { ipcRenderer } = require('electron');
  ipcRenderer.send('select-application', inputId);
}

function selectFile(inputId, extension) {
  const { ipcRenderer } = require('electron');
  ipcRenderer.send('select-file', { inputId, extension });
}

function selectAppForSite(index) {
  const { ipcRenderer } = require('electron');
  ipcRenderer.send('select-app-for-site', index);
}

function loadConfig() {
  try {
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } else {
      // Создаем конфигурацию по умолчанию
      config = { ...DEFAULT_CONFIG };
    }
    
    populateForm();
    renderFolders();
    renderSites();
    
    // Показываем основную вкладку по умолчанию
    showTab('main');
    
    // Убеждаемся, что активная кнопка таба подсвечена
    const mainTabBtn = document.querySelector('.tab-btn[onclick*="main"]');
    if (mainTabBtn) {
      mainTabBtn.classList.add('active');
    }
    
    // Устанавливаем начальное состояние элементов замены иконки
    updateIconChangeState(config.allowIconChange || false);
  } catch (error) {
    console.error('Ошибка загрузки конфигурации:', error);
    alert('Ошибка загрузки конфигурации');
  }
}

function populateForm() {
  // Устанавливаем текущий смайлик
  const currentEmoji = config.trayEmoji || '😊';
  const currentEmojiElement = document.getElementById('currentEmoji');
  if (currentEmojiElement) {
    if (currentEmoji === '✕') {
      currentEmojiElement.textContent = '✕';
      currentEmojiElement.style.fontSize = '16px';
      currentEmojiElement.style.fontWeight = 'bold';
    } else {
      currentEmojiElement.textContent = currentEmoji;
      currentEmojiElement.style.fontSize = '20px';
      currentEmojiElement.style.fontWeight = 'normal';
    }
  }
  
  // Устанавливаем текст трея
  const trayTextInput = document.getElementById('trayText');
  if (trayTextInput) {
    trayTextInput.value = config.trayText || '';
  }
  
  // Инициализируем состояние кнопок редактирования текста
  const editBtn = document.getElementById('edit-text-btn');
  const saveBtn = document.getElementById('save-text-btn');
  if (editBtn && saveBtn) {
    editBtn.style.display = 'inline-flex';
    saveBtn.style.display = 'none';
  }
  
  // Устанавливаем значение тумблера замены иконки
  const allowIconChangeToggle = document.getElementById('allowIconChange');
  if (allowIconChangeToggle) {
    allowIconChangeToggle.checked = config.allowIconChange || false;
    updateIconChangeState(config.allowIconChange || false);
  } else {
    // Если тумблер еще не загружен, устанавливаем состояние по умолчанию
    updateIconChangeState(config.allowIconChange || false);
  }
  
  // Если тумблер неактивен, устанавливаем смайлик по умолчанию
  if (!(config.allowIconChange || false)) {
    config.trayEmoji = '😊';
    const currentEmojiElement = document.getElementById('currentEmoji');
    if (currentEmojiElement) {
      currentEmojiElement.textContent = '😊';
    }
  }

  // Устанавливаем значение тумблера показа часов
  const showClockToggle = document.getElementById('showClock');
  if (showClockToggle) {
    showClockToggle.checked = config.showClock || false;
    updateTimeFormatState(config.showClock || false);
  }
  
  // Устанавливаем значение формата времени через визуальные элементы
  updateTimeFormatSelection(config.use24HourFormat !== false);
  updateAmPmToggleState(config.use24HourFormat === false);
  
  // Устанавливаем значение тумблера показа AM/PM
  const showAmPmToggle = document.getElementById('showAmPm');
  if (showAmPmToggle) {
    showAmPmToggle.checked = config.showAmPm !== false; // По умолчанию true
  }
  
  // Устанавливаем значение тумблера показа заряда батареи
  const showBatteryToggle = document.getElementById('showBattery');
  if (showBatteryToggle) {
    showBatteryToggle.checked = config.showBattery || false;
  }
  
  // Устанавливаем значение тумблера автозапуска
  const autoStartToggle = document.getElementById('autoStart');
  if (autoStartToggle) {
    autoStartToggle.checked = config.autoStart || false;
  }
}

function loadEmojiGrid() {
  const emojiGrid = document.getElementById('emojiGrid');
  emojiGrid.innerHTML = '';
  
  // Сначала добавляем крестик для "только текст"
  const crossItem = document.createElement('div');
  crossItem.className = 'emoji-item';
  crossItem.textContent = '✕';
  crossItem.title = 'Только текст (без смайлика)';
  emojiGrid.appendChild(crossItem);
  
  // Популярные смайлики для трея
  const emojis = [
    '😊', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
    '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘',
    '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪',
    '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒',
    '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖',
    '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡',
    '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰',
    '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶',
    '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮',
    '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴',
    '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠',
    '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃',
    '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿',
    '😾', '👶', '🧒', '👦', '👧', '🧑', '👨', '👩',
    '🧓', '👴', '👵', '👱', '👱‍♀️', '👱‍♂️', '🧔', '👨‍🦰',
    '👩‍🦰', '👨‍🦱', '👩‍🦱', '👨‍🦳', '👩‍🦳', '👨‍🦲', '👩‍🦲', '🤵',
    '👰', '🤰', '🤱', '👼', '🎅', '🤶', '🦸', '🦹',
    '🧙', '🧚', '🧛', '🧜', '🧝', '🧞', '🧟', '💆',
    '💇', '🚶', '🏃', '💃', '🕺', '👯', '🧘', '🛀',
    '🛌', '👭', '👫', '👬', '💏', '💑', '👪', '🗣️',
    '👤', '👥', '👣', '🐵', '🐒', '🦍', '🐶', '🐕',
    '🐩', '🐺', '🦊', '🐱', '🐈', '🦁', '🐯', '🐅',
    '🐆', '🐴', '🐎', '🦄', '🦓', '🦌', '🐮', '🐂',
    '🐃', '🐄', '🐷', '🐖', '🐗', '🐽', '🐏', '🐑',
    '🐐', '🐪', '🐫', '🦙', '🦒', '🐘', '🦏', '🦛',
    '🐭', '🐁', '🐀', '🐹', '🐰', '🐇', '🐿️', '🦔',
    '🦇', '🐻', '🐨', '🐼', '🦘', '🦡', '🐾', '🦃',
    '🐔', '🐓', '🐣', '🐤', '🐥', '🐦', '🐧', '🕊️',
    '🦅', '🦆', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄',
    '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗',
    '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕',
    '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟',
    '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓',
    '🦍', '🐘', '🦏', '🦛', '🐪', '🐫', '🦙', '🦒',
    '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙',
    '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐓',
    '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝',
    '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔'
  ];
  
  // Добавляем смайлики в сетку
  emojis.forEach(emoji => {
    const emojiItem = document.createElement('div');
    emojiItem.className = 'emoji-item';
    emojiItem.textContent = emoji;
    emojiItem.title = emoji;
    emojiGrid.appendChild(emojiItem);
  });
}

function selectEmoji(emoji) {
  // Обновляем конфигурацию
  config.trayEmoji = emoji;
  
  if (emoji === '✕') {
    // Проверяем, есть ли текст в трее
    const hasText = config.trayText && config.trayText.trim() !== '';
    
    if (!hasText) {
      // Если нет текста, отключаем замену иконки
      config.allowIconChange = false;
      document.getElementById('allowIconChange').checked = false;
      updateIconChangeState(false);
    } else {
      // Если есть текст, оставляем тумблер включенным, но не меняем его состояние
      // Пользователь сам решает, включать или выключать тумблер
    }
    
    // Обновляем отображение - показываем крестик
    const currentEmojiElement = document.getElementById('currentEmoji');
    if (currentEmojiElement) {
      currentEmojiElement.textContent = '✕';
      currentEmojiElement.style.fontSize = '16px';
      currentEmojiElement.style.fontWeight = 'bold';
    }
  } else {
    // Обычный смайлик включает замену иконки
    config.allowIconChange = true;
    document.getElementById('allowIconChange').checked = true;
    updateIconChangeState(true);
    
    // Обновляем отображение текущего смайлика
    const currentEmojiElement = document.getElementById('currentEmoji');
    if (currentEmojiElement) {
      currentEmojiElement.textContent = emoji;
      currentEmojiElement.style.fontSize = '20px';
      currentEmojiElement.style.fontWeight = 'normal';
    }
  }
  
  // Обновляем выделение в сетке
  updateEmojiSelection(emoji);
  
  // Автоматически закрываем попап после выбора
  closeEmojiPopup();
  
  // Создаем PNG иконку из смайлика
  createEmojiIconPNG(emoji);
  
  // Отправляем обновление конфигурации
  ipcRenderer.send('config-updated', config);
  
  // Показываем уведомление только для обычных смайликов
  if (emoji !== '✕') {
    const message = `Смайлик ${emoji} выбран для трея`;
    showNotification(message);
  }
}

function createEmojiIconPNG(emoji) {
  // Получаем текст трея
  const trayText = config.trayText || '';
  
  // Если выбран крестик (режим "только текст"), не создаем иконку
  if (emoji === '✕') {
    // Отправляем сигнал о том, что нужно использовать стандартную иконку
    ipcRenderer.send('emoji-icon-created', { emoji: '✕', dataURL: null, trayText });
    return;
  }
  
  // Получаем размер трея для текущей платформы
  const traySize = getTrayIconSize();
  
  // Создаем canvas высокого разрешения 64x64 для четкого отображения
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  
  // Включаем сглаживание для лучшего качества
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Устанавливаем четкий рендеринг текста
  ctx.textRenderingOptimization = 'optimizeQuality';
  
  // Не заливаем фон - оставляем прозрачным
  // ctx.fillStyle = 'white';
  // ctx.fillRect(0, 0, 64, 64);
  
  // Обычный смайлик
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
  
  // Конвертируем canvas в PNG data URL
  const dataURL = canvas.toDataURL('image/png');
  
  // Отправляем высококачественные PNG данные в основной процесс
  ipcRenderer.send('emoji-icon-created', { emoji, dataURL, trayText });
}

// Получаем оптимальный размер трея для текущей платформы
function getTrayIconSize() {
  // Определяем платформу через Electron
  const { remote } = require('electron');
  const platform = remote ? remote.process.platform : 'darwin'; // fallback для macOS
  
  if (platform === 'darwin') {
    return 22; // macOS трей обычно 22x22
  } else if (platform === 'win32') {
    return 16; // Windows трей обычно 16x16
  } else {
    return 24; // Linux трей обычно 24x24
  }
}

function updateEmojiSelection(selectedEmoji) {
  const emojiItems = document.querySelectorAll('.emoji-item');
  emojiItems.forEach(item => {
    if (item.textContent === selectedEmoji) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
}

function toggleEmojiPopup() {
  const emojiPopup = document.getElementById('emojiPopup');
  const emojiGrid = document.getElementById('emojiGrid');
  
  if (emojiPopup.classList.contains('hidden')) {
    // Показываем попап и загружаем смайлики, если они еще не загружены
    if (emojiGrid.children.length === 0) {
      loadEmojiGrid();
      // Обновляем выделение текущего смайлика
      const currentEmojiElement = document.getElementById('currentEmoji');
      if (currentEmojiElement) {
        const currentEmoji = currentEmojiElement.textContent;
        updateEmojiSelection(currentEmoji);
      }
    }
    emojiPopup.classList.remove('hidden');
    emojiPopup.classList.add('show');
  } else {
    // Скрываем попап
    closeEmojiPopup();
  }
}

function closeEmojiPopup() {
  const emojiPopup = document.getElementById('emojiPopup');
  emojiPopup.classList.remove('show');
  setTimeout(() => {
    emojiPopup.classList.add('hidden');
  }, 300); // Ждем завершения анимации
}

function renderSites() {
  const container = document.getElementById('sitesContainer');
  container.innerHTML = '';
  
  config.sites.forEach((site, index) => {
    const siteElement = createSiteElement(site, index);
    container.appendChild(siteElement);
  });
}

function renderFolders() {
  const container = document.getElementById('foldersContainer');
  container.innerHTML = '';
  
  config.folders.forEach((folder, index) => {
    const folderElement = createFolderElement(folder, index);
    container.appendChild(folderElement);
  });
}

function createFolderElement(folder, index) {
  const div = document.createElement('div');
  div.className = 'folder-item';
  
  const hasPath = folder.path && folder.path.trim() !== '';
  const buttonClass = hasPath ? 'folder-open-btn' : 'folder-select-btn';
  const buttonAction = `selectFolderForItem(${index})`;
  const buttonTitle = hasPath ? `Изменить путь: ${folder.path}` : 'Выбрать папку';
  
  div.innerHTML = `
    <div class="folder-row">
      <div class="folder-left">
        <button class="btn btn-icon ${buttonClass}" onclick="${buttonAction}" title="${buttonTitle}">
          📁
        </button>
        <div class="folder-name-container" id="folder-name-${index}" style="display: ${hasPath ? 'block' : 'none'};">
          <input type="text" placeholder="Название папки" value="${folder.label}" 
                 onchange="updateFolderLabel(${index}, this.value)" class="folder-name-input">
        </div>
        <span class="folder-hint" id="folder-hint-${index}" style="display: ${!hasPath ? 'inline' : 'none'};">
          ← нажмите на папку чтобы добавить
        </span>
      </div>
      <div class="folder-right">
        <button class="btn btn-icon btn-edit" onclick="editFolderName(${index})" title="Изменить название" style="display: ${hasPath ? 'inline-flex' : 'none'};">
          ✏️
        </button>
        <button class="btn btn-icon btn-remove" onclick="removeFolder(${index})" title="Удалить">
          ✕
        </button>
      </div>
    </div>
  `;
  return div;
}

function addFolder() {
  config.folders.push({
    label: '',
    path: ''
  });
  renderFolders();
  
  // Скроллим к новому элементу
  setTimeout(() => {
    const newFolder = document.querySelector('#foldersContainer .folder-item:last-child');
    if (newFolder) {
      newFolder.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);
  
  // НЕ отправляем обновление, пока путь не выбран
}

function removeFolder(index) {
  config.folders.splice(index, 1);
  renderFolders();
  // Отправляем обновление в реальном времени
  ipcRenderer.send('config-updated', config);
}

function updateFolderLabel(index, label) {
  config.folders[index].label = label;
  // Отправляем обновление только если путь не пустой
  if (config.folders[index].path && config.folders[index].path.trim() !== '') {
    ipcRenderer.send('config-updated', config);
  }
}

function selectFolderForItem(index) {
  const { ipcRenderer } = require('electron');
  ipcRenderer.send('select-folder-for-item', index);
}

function editFolderName(index) {
  const input = document.querySelector(`#foldersContainer .folder-item:nth-child(${index + 1}) .folder-name-input`);
  if (input) {
    input.focus();
    input.select();
  }
}

function editSiteName(index) {
  const input = document.querySelector(`#sitesContainer .site-item:nth-child(${index + 1}) .site-name-input`);
  if (input) {
    input.focus();
    input.select();
  }
}

function toggleSiteUrlField(index) {
  const site = config.sites[index];
  const isApp = site.type === 'app';
  
  if (isApp) {
    // Для приложений сразу открываем диалог выбора
    selectAppForSite(index);
    return;
  }
  
  // Для сайтов - стандартная логика переключения полей
  const urlContainer = document.getElementById(`site-url-${index}`);
  const nameContainer = document.getElementById(`site-name-${index}`);
  const actionsNormal = document.getElementById(`site-actions-normal-${index}`);
  const actionsSave = document.getElementById(`site-actions-save-${index}`);
  const siteHint = document.getElementById(`site-hint-${index}`);
  
  if (urlContainer && nameContainer && actionsNormal && actionsSave) {
    const isUrlMode = urlContainer.style.display !== 'none';
    
    if (isUrlMode) {
      // Возвращаемся к обычному режиму
      urlContainer.style.display = 'none';
      
      // Показываем поле названия только если есть ссылка
      if (site.url) {
        nameContainer.style.display = 'block';
      } else {
        nameContainer.style.display = 'none';
      }
      
      actionsNormal.style.display = 'flex';
      actionsNormal.style.flexDirection = 'row';
      actionsNormal.style.alignItems = 'center';
      actionsSave.style.display = 'none';
      
      // Показываем подсказку, если нет ссылки
      if (siteHint) {
        siteHint.style.display = !site.url ? 'inline' : 'none';
      }
    } else {
      // Переключаемся в режим ввода URL
      urlContainer.style.display = 'block';
      nameContainer.style.display = 'none';
      actionsNormal.style.display = 'none';
      actionsSave.style.display = 'flex';
      actionsSave.style.flexDirection = 'row';
      actionsSave.style.alignItems = 'center';
      
      // Скрываем подсказку
      if (siteHint) {
        siteHint.style.display = 'none';
      }
      
      // Фокусируемся на поле URL
      const urlInput = urlContainer.querySelector('.site-url-input');
      if (urlInput) {
        urlInput.focus();
      }
    }
  }
}

function saveSiteUrl(index) {
  const urlInput = document.getElementById(`site-url-${index}`).querySelector('.site-url-input');
  if (urlInput && urlInput.value.trim()) {
    const url = 'https://' + urlInput.value.trim();
    config.sites[index].url = url;
    
    // Переключаемся обратно к обычному режиму
    toggleSiteUrlField(index);
    
    // Показываем поле названия, если его нет
    const nameContainer = document.getElementById(`site-name-${index}`);
    if (nameContainer) {
      nameContainer.style.display = 'block';
    }
    
    // Скрываем подсказку, так как ссылка теперь есть
    const siteHint = document.getElementById(`site-hint-${index}`);
    if (siteHint) {
      siteHint.style.display = 'none';
    }
    
    // Отправляем обновление конфигурации
    ipcRenderer.send('config-updated', config);
  }
}



function createSiteElement(site, index) {
  const div = document.createElement('div');
  div.className = 'site-item';
  
  const isApp = site.type === 'app';
  const placeholder = isApp ? 'Название приложения' : 'Название сайта';
  const valuePlaceholder = isApp ? 'Путь к приложению' : 'URL сайта';
  
  div.innerHTML = `
    <div class="site-row">
              <div class="site-left">
          <button class="btn btn-icon site-globe ${isApp ? 'app' : 'site'}" onclick="toggleSiteUrlField(${index})" title="${isApp ? 'Выбрать приложение' : 'Ввести ссылку на сайт'}">
            ${isApp ? '👾' : '🌐'}
          </button>
          <div class="site-name-container" id="site-name-${index}" style="display: ${(isApp && site.url) || (!isApp && site.url) ? 'block' : 'none'};">
            <input type="text" placeholder="${isApp ? placeholder : 'введите название'}" value="${isApp ? site.label : (site.url ? site.label : '')}" 
                   onchange="updateSiteLabel(${index}, this.value)" class="site-name-input">
          </div>
          <span class="site-hint" id="site-hint-${index}" style="display: ${!isApp && !site.url ? 'inline' : 'none'};">
            ← введите ссылку через 🌐
          </span>
          <span class="app-hint" id="app-hint-${index}" style="display: ${isApp && !site.url ? 'inline' : 'none'};">
            ← нажмите на 👾 чтобы выбрать приложение
          </span>
          <div class="site-url-container" id="site-url-${index}" style="display: none;">
            <div class="url-input-wrapper">
              <span class="url-prefix">https://</span>
              <input type="text" placeholder="example.com" value="${site.url ? site.url.replace('https://', '') : ''}" 
                     class="site-url-input" onchange="updateSiteUrl(${index}, 'https://' + this.value)">
            </div>
          </div>
        </div>
      <div class="site-right">
        <div class="site-actions-normal" id="site-actions-normal-${index}">
          <button class="btn btn-icon btn-edit" onclick="editSiteName(${index})" title="Изменить название">✏️</button>
          <button class="btn btn-icon btn-remove" onclick="removeSite(${index})" title="Удалить">✕</button>
        </div>
        <div class="site-actions-save" id="site-actions-save-${index}" style="display: none;">
          <button class="btn btn-icon btn-save" onclick="saveSiteUrl(${index})" title="Сохранить">✅</button>
        </div>
      </div>
    </div>
  `;
  return div;
}

function addSite() {
  config.sites.push({
    label: '',
    url: '',
    type: 'site'
  });
  renderSites();
  
  // Скроллим к новому элементу
  setTimeout(() => {
    const newSite = document.querySelector('#sitesContainer .site-item:last-child');
    if (newSite) {
      newSite.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);
}

function addApplication() {
  // Сначала добавляем приложение в конфигурацию
  const newIndex = config.sites.length;
  config.sites.push({
    label: 'Новое приложение',
    url: '',
    type: 'app'
  });
  renderSites();
  
  // Сразу открываем диалог выбора приложения
  setTimeout(() => {
    selectAppForSite(newIndex);
    
    // Скроллим к новому элементу
    const newSite = document.querySelector('#sitesContainer .site-item:last-child');
    if (newSite) {
      newSite.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);
}

function selectAppForSite(index) {
  // Используем ipcRenderer для вызова диалога через main process
  ipcRenderer.send('select-app-for-site', index);
}

// Убрал функцию toggleSiteType - теперь тип определяется при создании

function removeSite(index) {
  config.sites.splice(index, 1);
  renderSites();
}

function updateSiteLabel(index, label) {
  config.sites[index].label = label;
}

function updateSiteUrl(index, url) {
  config.sites[index].url = url;
}


// Функция updateToggleState удалена - настройка браузера больше не используется

// Функция для открытия ссылок - всегда используем внешний браузер
function openLink(url) {
  ipcRenderer.send('open-external-browser', url);
}

function showNotification(message) {
  // Создаем временное уведомление
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #007AFF;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = message;
  
  // Добавляем CSS анимацию
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  // Удаляем через 3 секунды
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}


function saveSettings() {
  try {
    // Фильтруем папки с пустыми путями перед сохранением
    config.folders = config.folders.filter(folder => folder.path && folder.path.trim() !== '');
    
    // Сохраняем в файл
    const configPath = path.join(__dirname, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    // Отправляем обновленную конфигурацию в основной процесс
    ipcRenderer.send('config-updated', config);
    
    showNotification('Настройки сохранены!');
    
    // Закрываем окно настроек через 2 секунды
    setTimeout(() => {
      window.close();
    }, 2000);
  } catch (error) {
    console.error('Ошибка сохранения:', error);
    showNotification('Ошибка сохранения настроек: ' + error.message);
  }
}


function resetToDefaults() {
  // Отправляем запрос на показ диалога подтверждения в главном процессе
  require('electron').ipcRenderer.send('show-reset-confirm-dialog');
}


function updateIconChangeState(isAllowed) {
  const iconContent = document.getElementById('iconChangeContent');
  
  if (isAllowed) {
    // Показываем контент для замены иконки
    iconContent.classList.remove('hidden');
    iconContent.classList.add('visible');
  } else {
    // Скрываем контент для замены иконки
    iconContent.classList.remove('visible');
    iconContent.classList.add('hidden');
    
    // Закрываем попап смайликов, если он открыт
    const emojiPopup = document.getElementById('emojiPopup');
    if (emojiPopup && !emojiPopup.classList.contains('hidden')) {
      closeEmojiPopup();
    }
    
    // Не сбрасываем смайлик, просто скрываем интерфейс
    // Пользователь может включить тумблер обратно и увидеть свой выбор
  }
}

function updateTimeFormatState(isClockEnabled) {
  const timeFormatContent = document.getElementById('timeFormatContent');
  
  if (isClockEnabled) {
    // Показываем контент для выбора формата времени
    timeFormatContent.classList.remove('hidden');
    timeFormatContent.classList.add('visible');
    
    // Обновляем состояние тумблера AM/PM
    updateAmPmToggleState(config.use24HourFormat === false);
  } else {
    // Скрываем контент для выбора формата времени
    timeFormatContent.classList.remove('visible');
    timeFormatContent.classList.add('hidden');
  }
}

function updateAmPmToggleState(is12HourFormat) {
  const amPmToggleContainer = document.getElementById('amPmToggleContainer');
  
  if (is12HourFormat) {
    // Показываем тумблер AM/PM только для 12-часового формата
    amPmToggleContainer.style.display = 'block';
  } else {
    // Скрываем тумблер AM/PM для 24-часового формата
    amPmToggleContainer.style.display = 'none';
  }
}

function selectTimeFormat(is24Hour) {
  // Обновляем конфигурацию
  config.use24HourFormat = is24Hour;
  
  // Обновляем состояние тумблера (элемент не существует, управляется через selectTimeFormat)
  
  // Обновляем визуальное состояние опций
  updateTimeFormatSelection(is24Hour);
  
  // Обновляем состояние тумблера AM/PM
  updateAmPmToggleState(!is24Hour);
  
  // Отправляем обновление конфигурации
  ipcRenderer.send('config-updated', config);
}

function updateTimeFormatSelection(is24Hour) {
  const timeFormat12 = document.getElementById('timeFormat12');
  const timeFormat24 = document.getElementById('timeFormat24');
  
  if (timeFormat12 && timeFormat24) {
    if (is24Hour) {
      timeFormat12.classList.remove('selected');
      timeFormat24.classList.add('selected');
    } else {
      timeFormat12.classList.add('selected');
      timeFormat24.classList.remove('selected');
    }
  }
}

function updateTrayText(text) {
  // Обновляем конфигурацию
  config.trayText = text;
  
  // Отправляем обновление текста трея в реальном времени
  ipcRenderer.send('update-tray-text', text);
  
  // Отправляем обновление конфигурации
  ipcRenderer.send('config-updated', config);
  
  // Показываем уведомление
  if (text.trim()) {
    showNotification(`Текст трея обновлен: "${text}"`);
  } else {
    showNotification('Текст трея очищен');
  }
}

function editTrayText() {
  const textInput = document.getElementById('trayText');
  const editBtn = document.getElementById('edit-text-btn');
  const saveBtn = document.getElementById('save-text-btn');
  
  if (textInput && editBtn && saveBtn) {
    // Переключаемся в режим редактирования
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-flex';
    
    // Фокусируемся на поле ввода
    textInput.focus();
    textInput.select();
  }
}

function saveTrayText() {
  const textInput = document.getElementById('trayText');
  const editBtn = document.getElementById('edit-text-btn');
  const saveBtn = document.getElementById('save-text-btn');
  
  if (textInput && editBtn && saveBtn) {
    // Сохраняем текст
    updateTrayText(textInput.value);
    
    // Возвращаемся к обычному режиму
    editBtn.style.display = 'inline-flex';
    saveBtn.style.display = 'none';
  }
}

function showHelpTooltip(event, tooltipId) {
  event.stopPropagation();
  
  // Скрываем все другие подсказки
  const allTooltips = document.querySelectorAll('.help-tooltip');
  allTooltips.forEach(tooltip => tooltip.classList.remove('show'));
  
  // Показываем нужную подсказку
  const tooltip = document.getElementById(tooltipId);
  if (tooltip) {
    tooltip.classList.add('show');
    
    // Позиционируем подсказку
    const rect = event.target.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth;
    const windowWidth = window.innerWidth;
    
    // Центрируем подсказку относительно кнопки
    let left = rect.left - (tooltipWidth / 2) + 10;
    
    // Проверяем, чтобы подсказка не выходила за границы экрана
    if (left < 20) left = 20;
    if (left + tooltipWidth > windowWidth - 20) left = windowWidth - tooltipWidth - 20;
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = (rect.bottom + 10) + 'px';
  }
}

// Функции для работы с обновлениями
function checkForUpdates() {
  const btn = document.getElementById('checkUpdatesBtn');
  const status = document.getElementById('updateStatus');
  const message = status.querySelector('.update-message');
  
  // Показываем статус проверки
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-text">Проверяем...</span>';
  status.style.display = 'block';
  status.className = 'update-status info';
  message.textContent = 'Проверяем наличие обновлений...';
  
  // Отправляем запрос на проверку обновлений
  ipcRenderer.send('check-for-updates');
}

// Обработчики событий обновлений
ipcRenderer.on('update-check-started', () => {
  console.log('Проверка обновлений начата');
});

ipcRenderer.on('update-check-result', (event, result) => {
  const btn = document.getElementById('checkUpdatesBtn');
  const status = document.getElementById('updateStatus');
  const message = status.querySelector('.update-message');
  
  // Восстанавливаем кнопку
  btn.disabled = false;
  btn.innerHTML = '<span class="btn-text">Проверить обновления</span>';
  
  // Показываем результат
  status.style.display = 'block';
  
  if (result.error) {
    status.className = 'update-status error';
    message.textContent = 'Ошибка проверки';
  } else if (result.available) {
    status.className = 'update-status success';
    message.textContent = `Доступна версия ${result.version}. Обновить?`;
    // Добавляем кнопку обновления
    btn.innerHTML = '<span class="btn-text">Обновить</span>';
    btn.onclick = () => {
      // Отправляем запрос на скачивание обновления
      ipcRenderer.send('download-update');
      message.textContent = 'Скачивание обновления...';
      btn.disabled = true;
    };
  } else {
    status.className = 'update-status info';
    message.textContent = 'Не найдено';
  }
});

// Обработчик начала скачивания
ipcRenderer.on('update-download-started', () => {
  console.log('Начато скачивание обновления');
});

// Обработчик прогресса скачивания
ipcRenderer.on('update-download-progress', (event, progress) => {
  const status = document.getElementById('updateStatus');
  const message = status.querySelector('.update-message');
  
  status.style.display = 'block';
  status.className = 'update-status info';
  message.textContent = progress.message;
});

// Обработчик завершения скачивания
ipcRenderer.on('update-downloaded', (event, info) => {
  const btn = document.getElementById('checkUpdatesBtn');
  const status = document.getElementById('updateStatus');
  const message = status.querySelector('.update-message');
  
  status.style.display = 'block';
  status.className = 'update-status success';
  message.textContent = `Обновление ${info.version} готово к установке`;
  
  btn.disabled = false;
  btn.innerHTML = '<span class="btn-text">Перезапустить</span>';
  btn.onclick = () => {
    // Отправляем команду на перезапуск
    ipcRenderer.send('restart-app');
  };
});
