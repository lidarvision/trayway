# Настройка GitHub для автоматических обновлений

## 📋 Что нужно сделать для работы системы обновлений:

### 1. Создать GitHub репозиторий
- Создайте репозиторий с названием `trayway` на GitHub
- Username должен быть `lidarvision` (или измените в main.js)

### 2. Настроить GitHub Releases
- Перейдите в раздел "Releases" вашего репозитория
- Создайте новый релиз с версией `v1.0.0`
- Загрузите DMG файлы как assets:
  - `TrayWay-arm64.dmg` (для Apple Silicon)
  - `TrayWay-x64.dmg` (для Intel Mac)
  - `TrayWay-universal.dmg` (универсальная версия)

### 3. Настроить автоматическую публикацию релизов
Создайте файл `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Build and release
        run: |
          npm run release:all
          
      - name: Upload Release Assets
        uses: actions/upload-release-asset@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          upload_url: ${{ steps.create_release.outputs.upload_url }}
          asset_path: ./release-build/TrayWay-arm64.dmg
          asset_name: TrayWay-arm64.dmg
          asset_content_type: application/octet-stream
```

### 4. Как выпускать обновления
1. Обновите версию в `package.json`
2. Создайте git tag: `git tag v1.0.1`
3. Запушьте изменения: `git push origin main --tags`
4. GitHub Actions автоматически создаст релиз с новыми DMG файлами

### 5. Тестирование обновлений
- Приложение будет проверять обновления каждые 30 минут
- Пользователи могут проверить обновления вручную через меню трея
- При наличии обновления появится уведомление в трее

## 🔧 Настройки в коде

В `main.js` уже настроено:
- ✅ Проверка обновлений каждую неделю
- ✅ Уведомления в трее о доступных обновлениях
- ✅ Диалог подтверждения перед установкой
- ✅ Автоматическая установка при выходе из приложения

## 📱 Пользовательский опыт

1. **Автоматическая проверка**: Каждую неделю
2. **Уведомление**: Balloon в трее при наличии обновления
3. **Скачивание**: По запросу пользователя
4. **Установка**: Диалог с предложением перезапустить
5. **Ручная проверка**: Через меню трея "Проверить обновления"

## 🚀 Готово к релизу!

Ваше приложение теперь поддерживает автоматические обновления через GitHub!
