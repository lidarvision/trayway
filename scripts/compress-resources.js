const fs = require('fs');
const path = require('path');

function compressAppResources(appPath) {
  console.log('🗜️ Сжимаю ресурсы приложения...');
  
  const appResourcesPath = path.join(appPath, 'Contents', 'Resources', 'app');
  
  if (!fs.existsSync(appResourcesPath)) {
    console.log('Путь к ресурсам приложения не найден');
    return 0;
  }
  
  let totalSaved = 0;
  
  // Сжимаем HTML файлы
  const htmlFiles = findFiles(appResourcesPath, '.html');
  htmlFiles.forEach(file => {
    const originalSize = fs.statSync(file).size;
    try {
      // Простое сжатие HTML (удаление лишних пробелов и комментариев)
      let content = fs.readFileSync(file, 'utf8');
      content = content
        .replace(/\s+/g, ' ') // Заменяем множественные пробелы на один
        .replace(/<!--[\s\S]*?-->/g, '') // Удаляем комментарии
        .replace(/>\s+</g, '><') // Удаляем пробелы между тегами
        .trim();
      
      fs.writeFileSync(file, content);
      
      const newSize = fs.statSync(file).size;
      const saved = originalSize - newSize;
      totalSaved += saved;
      
      console.log(`Сжат ${path.basename(file)}: ${formatBytes(originalSize)} → ${formatBytes(newSize)} (экономия: ${formatBytes(saved)})`);
    } catch (error) {
      console.error(`Ошибка при сжатии ${file}:`, error.message);
    }
  });
  
  // Сжимаем CSS файлы
  const cssFiles = findFiles(appResourcesPath, '.css');
  cssFiles.forEach(file => {
    const originalSize = fs.statSync(file).size;
    try {
      let content = fs.readFileSync(file, 'utf8');
      content = content
        .replace(/\s+/g, ' ') // Заменяем множественные пробелы на один
        .replace(/\/\*[\s\S]*?\*\//g, '') // Удаляем комментарии
        .replace(/;\s*}/g, '}') // Удаляем точку с запятой перед закрывающей скобкой
        .replace(/{\s*/g, '{') // Удаляем пробелы после открывающей скобки
        .replace(/\s*}/g, '}') // Удаляем пробелы перед закрывающей скобкой
        .replace(/:\s*/g, ':') // Удаляем пробелы после двоеточия
        .replace(/;\s*/g, ';') // Удаляем пробелы после точки с запятой
        .trim();
      
      fs.writeFileSync(file, content);
      
      const newSize = fs.statSync(file).size;
      const saved = originalSize - newSize;
      totalSaved += saved;
      
      console.log(`Сжат ${path.basename(file)}: ${formatBytes(originalSize)} → ${formatBytes(newSize)} (экономия: ${formatBytes(saved)})`);
    } catch (error) {
      console.error(`Ошибка при сжатии ${file}:`, error.message);
    }
  });
  
  // Пропускаем сжатие JS файлов для избежания ошибок
  console.log('⚠️ Пропускаю сжатие JS файлов для избежания ошибок');
  
  console.log(`\n🗜️ Сжатие завершено! Сэкономлено: ${formatBytes(totalSaved)}`);
  return totalSaved;
}

function findFiles(dir, extension) {
  const files = [];
  
  function searchDir(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    items.forEach(item => {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        searchDir(fullPath);
      } else if (item.endsWith(extension)) {
        files.push(fullPath);
      }
    });
  }
  
  searchDir(dir);
  return files;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Запускаем сжатие
const appPath = process.argv[2];
if (!appPath) {
  console.error('Использование: node compress-resources.js <путь_к_приложению>');
  console.error('Пример: node compress-resources.js "release-build/trayyyy-darwin-arm64/trayyyy.app"');
  process.exit(1);
}

if (!fs.existsSync(appPath)) {
  console.error('Путь к приложению не найден:', appPath);
  process.exit(1);
}

compressAppResources(appPath);
