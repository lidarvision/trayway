const fs = require('fs');
const path = require('path');

// Список языков, которые нужно оставить (английский и русский)
const KEEP_LOCALES = ['en', 'en_GB', 'ru'];

// Настройки оптимизации
const OPTIMIZATION_SETTINGS = {
  removeGPU: true, // Удалить GPU библиотеки (если не используются)
  removeUnusedResources: true, // Удалить неиспользуемые ресурсы
  compressResources: false // Сжать ресурсы (может замедлить запуск)
};

function optimizeElectronApp(appPath) {
  console.log('Начинаю оптимизацию приложения...');
  
  const frameworksPath = path.join(appPath, 'Contents', 'Frameworks', 'Electron Framework.framework', 'Resources');
  
  if (!fs.existsSync(frameworksPath)) {
    console.error('Путь к Electron Framework не найден:', frameworksPath);
    return;
  }
  
  // Получаем список всех языковых папок
  const items = fs.readdirSync(frameworksPath);
  const localeDirs = items.filter(item => {
    const fullPath = path.join(frameworksPath, item);
    return fs.statSync(fullPath).isDirectory() && item.endsWith('.lproj');
  });
  
  console.log('Найдено языковых папок:', localeDirs.length);
  
  let totalSaved = 0;
  
  // Удаляем ненужные языковые папки
  localeDirs.forEach(localeDir => {
    const localeName = localeDir.replace('.lproj', '');
    
    if (!KEEP_LOCALES.includes(localeName)) {
      const fullPath = path.join(frameworksPath, localeDir);
      
      // Получаем размер папки перед удалением
      const size = getDirectorySize(fullPath);
      totalSaved += size;
      
      console.log(`Удаляю ${localeDir} (${formatBytes(size)})`);
      
      try {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } catch (error) {
        console.error(`Ошибка при удалении ${localeDir}:`, error.message);
      }
    } else {
      console.log(`Оставляю ${localeDir}`);
    }
  });
  
  console.log(`\nОптимизация завершена! Сэкономлено: ${formatBytes(totalSaved)}`);
  
  // Также удаляем ненужные локализации из основного Resources
  const mainResourcesPath = path.join(appPath, 'Contents', 'Resources');
  if (fs.existsSync(mainResourcesPath)) {
    const mainItems = fs.readdirSync(mainResourcesPath);
    const mainLocaleDirs = mainItems.filter(item => {
      const fullPath = path.join(mainResourcesPath, item);
      return fs.statSync(fullPath).isDirectory() && item.endsWith('.lproj');
    });
    
    mainLocaleDirs.forEach(localeDir => {
      const localeName = localeDir.replace('.lproj', '');
      
      if (!KEEP_LOCALES.includes(localeName)) {
        const fullPath = path.join(mainResourcesPath, localeDir);
        const size = getDirectorySize(fullPath);
        totalSaved += size;
        
        console.log(`Удаляю из основного Resources: ${localeDir} (${formatBytes(size)})`);
        
        try {
          fs.rmSync(fullPath, { recursive: true, force: true });
        } catch (error) {
          console.error(`Ошибка при удалении ${localeDir}:`, error.message);
        }
      }
    });
  }
  
  console.log(`\nОбщая экономия: ${formatBytes(totalSaved)}`);
  
  // Дополнительная оптимизация GPU библиотек
  if (OPTIMIZATION_SETTINGS.removeGPU) {
    const gpuSaved = removeGPULibraries(appPath);
    totalSaved += gpuSaved;
  }
  
  // Удаление неиспользуемых ресурсов
  if (OPTIMIZATION_SETTINGS.removeUnusedResources) {
    const resourcesSaved = removeUnusedResources(appPath);
    totalSaved += resourcesSaved;
  }
  
  console.log(`\n🎉 ФИНАЛЬНАЯ ЭКОНОМИЯ: ${formatBytes(totalSaved)}`);
  console.log(`📦 Новый размер приложения: ${formatBytes(getDirectorySize(appPath))}`);
}

function getDirectorySize(dirPath) {
  let totalSize = 0;
  
  function calculateSize(itemPath) {
    const stats = fs.statSync(itemPath);
    
    if (stats.isDirectory()) {
      const items = fs.readdirSync(itemPath);
      items.forEach(item => {
        calculateSize(path.join(itemPath, item));
      });
    } else {
      totalSize += stats.size;
    }
  }
  
  try {
    calculateSize(dirPath);
  } catch (error) {
    console.error('Ошибка при расчете размера:', error.message);
  }
  
  return totalSize;
}

function removeGPULibraries(appPath) {
  console.log('\n🔧 Удаляю GPU библиотеки...');
  
  const librariesPath = path.join(appPath, 'Contents', 'Frameworks', 'Electron Framework.framework', 'Libraries');
  
  if (!fs.existsSync(librariesPath)) {
    console.log('Путь к библиотекам не найден');
    return 0;
  }
  
  // Список GPU библиотек, которые можно удалить если не используются
  const gpuLibraries = [
    'libvk_swiftshader.dylib', // 16MB - SwiftShader для Vulkan
    'libGLESv2.dylib', // 6.7MB - OpenGL ES 2.0
    'libEGL.dylib', // 108KB - EGL
    'vk_swiftshader_icd.json' // 4KB - Vulkan ICD
  ];
  
  let totalSaved = 0;
  
  gpuLibraries.forEach(libName => {
    const libPath = path.join(librariesPath, libName);
    
    if (fs.existsSync(libPath)) {
      const size = fs.statSync(libPath).size;
      totalSaved += size;
      
      console.log(`Удаляю ${libName} (${formatBytes(size)})`);
      
      try {
        fs.unlinkSync(libPath);
      } catch (error) {
        console.error(`Ошибка при удалении ${libName}:`, error.message);
      }
    }
  });
  
  console.log(`GPU библиотеки удалены. Сэкономлено: ${formatBytes(totalSaved)}`);
  return totalSaved;
}

function removeUnusedResources(appPath) {
  console.log('\n🗑️ Удаляю неиспользуемые ресурсы...');
  
  const resourcesPath = path.join(appPath, 'Contents', 'Frameworks', 'Electron Framework.framework', 'Resources');
  
  if (!fs.existsSync(resourcesPath)) {
    console.log('Путь к ресурсам не найден');
    return 0;
  }
  
  // Список ресурсов, которые можно удалить
  const unusedResources = [
    'chrome_200_percent.pak', // 184KB - высокое разрешение UI
    'chrome_100_percent.pak', // 116KB - стандартное разрешение UI
    'MainMenu.nib' // 4KB - меню macOS
  ];
  
  let totalSaved = 0;
  
  unusedResources.forEach(resourceName => {
    const resourcePath = path.join(resourcesPath, resourceName);
    
    if (fs.existsSync(resourcePath)) {
      const size = fs.statSync(resourcePath).size;
      totalSaved += size;
      
      console.log(`Удаляю ${resourceName} (${formatBytes(size)})`);
      
      try {
        fs.unlinkSync(resourcePath);
      } catch (error) {
        console.error(`Ошибка при удалении ${resourceName}:`, error.message);
      }
    }
  });
  
  console.log(`Неиспользуемые ресурсы удалены. Сэкономлено: ${formatBytes(totalSaved)}`);
  return totalSaved;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Запускаем оптимизацию
const appPath = process.argv[2];
if (!appPath) {
  console.error('Использование: node optimize-app.js <путь_к_приложению>');
  console.error('Пример: node optimize-app.js "release-build/trayyyy-darwin-arm64/trayyyy.app"');
  process.exit(1);
}

if (!fs.existsSync(appPath)) {
  console.error('Путь к приложению не найден:', appPath);
  process.exit(1);
}

optimizeElectronApp(appPath);
