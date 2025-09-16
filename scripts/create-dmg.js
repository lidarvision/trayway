const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Создаем инструкции для пользователей
function createInstructions() {
  const instructions = `TrayWay - Инструкция по установке

Быстрая установка

1. Перетащите TrayWay.app в папку Applications
2. Запустите приложение из папки Applications
3. Разрешите доступ при первом запуске

Если приложение не запускается

macOS показывает предупреждение "Неизвестный разработчик"

1. Откройте Системные настройки → Конфиденциальность и безопасность
2. Найдите сообщение о блокировке TrayWay
3. Нажмите "Все равно открыть"
4. Подтвердите действие

Альтернативный способ через Finder

1. Правый клик на TrayWay.app
2. Выберите "Открыть"
3. Нажмите "Открыть" в диалоге подтверждения

Настройка автозапуска

При первом запуске приложение предложит настроить автозапуск:

- "Да" - TrayWay будет запускаться при входе в систему
- "Нет" - запуск только вручную

Настройку можно изменить в любое время через меню приложения.

Использование

- Клик по иконке в трее - открывает меню
- Cmd+1 - быстрое меню (можно настроить)
- Правый клик - контекстное меню
- Проверить обновления - в настройках (Дополнительно)

Настройки

Откройте настройки через меню трея для:
- Добавления папок и сайтов
- Изменения иконки (эмодзи)
- Настройки часов и батареи
- Управления автозапуском

Поддержка

Если у вас возникли проблемы, обращайтесь в Telegram @lidarvision
`;

  return instructions;
}

// Создаем DMG файл
function createDMG(appPath, outputPath, architecture) {
  console.log(`\n📦 Создаю DMG для ${architecture}...`);
  
  const tempDir = path.join(__dirname, '..', 'temp-dmg');
  const dmgName = `TrayWay-${architecture}`;
  
  // Создаем временную папку
  if (fs.existsSync(tempDir)) {
    execSync(`rm -rf "${tempDir}"`);
  }
  fs.mkdirSync(tempDir, { recursive: true });
  
  try {
    // Копируем приложение
    execSync(`cp -R "${appPath}" "${tempDir}/"`);
    
    // Создаем ссылку на Applications
    execSync(`ln -s /Applications "${tempDir}/Applications"`);
    
    // Создаем файл с инструкциями
    const instructions = createInstructions();
    fs.writeFileSync(path.join(tempDir, 'README.txt'), instructions);
    
    // Создаем DMG
    const dmgPath = path.join(__dirname, '..', 'release-build', `${dmgName}.dmg`);
    
    // Удаляем старый DMG если есть
    if (fs.existsSync(dmgPath)) {
      fs.unlinkSync(dmgPath);
    }
    
    // Создаем DMG с помощью hdiutil
    execSync(`hdiutil create -volname "${dmgName}" -srcfolder "${tempDir}" -ov -format UDZO "${dmgPath}"`);
    
    console.log(`✅ DMG создан: ${dmgPath}`);
    console.log(`📏 Размер: ${formatBytes(fs.statSync(dmgPath).size)}`);
    
    // Очищаем временную папку
    execSync(`rm -rf "${tempDir}"`);
    
    return dmgPath;
  } catch (error) {
    console.error(`❌ Ошибка создания DMG для ${architecture}:`, error.message);
    // Очищаем временную папку в случае ошибки
    if (fs.existsSync(tempDir)) {
      execSync(`rm -rf "${tempDir}"`);
    }
    return null;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Основная функция
function main() {
  const architecture = process.argv[2];
  
  if (!architecture) {
    console.error('Использование: node create-dmg.js <архитектура>');
    console.error('Примеры:');
    console.error('  node create-dmg.js arm64');
    console.error('  node create-dmg.js x64');
    console.error('  node create-dmg.js universal');
    process.exit(1);
  }
  
  const releaseBuildPath = path.join(__dirname, '..', 'release-build');
  let appPath;
  
  switch (architecture) {
    case 'arm64':
      appPath = path.join(releaseBuildPath, 'TrayWay-darwin-arm64', 'TrayWay.app');
      break;
    case 'x64':
      appPath = path.join(releaseBuildPath, 'TrayWay-darwin-x64', 'TrayWay.app');
      break;
    case 'universal':
      appPath = path.join(releaseBuildPath, 'TrayWay-Universal', 'TrayWay.app');
      break;
    default:
      console.error('❌ Неизвестная архитектура:', architecture);
      console.error('Доступные: arm64, x64, universal');
      process.exit(1);
  }
  
  if (!fs.existsSync(appPath)) {
    console.error('❌ Приложение не найдено:', appPath);
    console.error('Сначала создайте сборку с помощью npm run build:optimized');
    process.exit(1);
  }
  
  const dmgPath = createDMG(appPath, releaseBuildPath, architecture);
  
  if (dmgPath) {
    console.log(`\n🎉 DMG файл готов: ${path.basename(dmgPath)}`);
    console.log(`📁 Расположение: ${dmgPath}`);
  } else {
    console.error('❌ Не удалось создать DMG файл');
    process.exit(1);
  }
}

main();
