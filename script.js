const { shell, ipcRenderer } = require('electron');

function updateClock() {
  const now = new Date();
  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  h = h % 12;
  h = h ? h : 12; // 0 => 12
  document.getElementById('clock').textContent = `${h}:${m}`;
}
setInterval(updateClock, 1000);
updateClock();

window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (link.href.startsWith('folder://')) {
        const folderPath = link.href.replace('folder://', '');
        shell.openPath(folderPath);
      } else {
        shell.openExternal(link.href);
      }
    });
  });
  const projectsBtn = document.getElementById('projects-btn');
  if (projectsBtn) {
    projectsBtn.addEventListener('click', () => {
      ipcRenderer.send('open-projects');
    });
  }
  const pulsenseBtn = document.getElementById('pulsense-btn');
  if (pulsenseBtn) {
    pulsenseBtn.addEventListener('click', () => {
      ipcRenderer.invoke('open-tunnel-script');
    });
  }
  const sshBtn = document.getElementById('ssh-btn');
  if (sshBtn) {
    sshBtn.addEventListener('click', () => {
      shell.openExternal('https://lidarvision.xyz/ssh'); // URL вашего web-ssh клиента
    });
  }
}); 