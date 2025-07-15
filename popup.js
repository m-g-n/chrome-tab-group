class PopupUI {
  constructor() {
    this.initializeElements();
    this.attachEventListeners();
    this.loadCurrentGroups();
  }

  initializeElements() {
    this.jsonFileInput = document.getElementById('jsonFileInput');
    this.refreshGroupsBtn = document.getElementById('refreshGroups');
    this.exportAllGroupsBtn = document.getElementById('exportAllGroups');
    this.groupsList = document.getElementById('groupsList');
    this.statusDiv = document.getElementById('status');
  }

  attachEventListeners() {
    this.refreshGroupsBtn.addEventListener('click', () => this.loadCurrentGroups());
    this.exportAllGroupsBtn.addEventListener('click', () => this.exportAllGroups());
    
    this.jsonFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const fileName = file.name;
        document.querySelector('.file-input-label').textContent = fileName;
        this.loadFromJsonFile();
      } else {
        document.querySelector('.file-input-label').textContent = 'JSONファイルを選択';
      }
    });
  }

  async sendMessage(action, data = {}) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action, ...data }, resolve);
    });
  }

  showStatus(message, type = 'success') {
    this.statusDiv.textContent = message;
    this.statusDiv.className = `status ${type}`;
    this.statusDiv.classList.remove('hidden');
    
    setTimeout(() => {
      this.statusDiv.classList.add('hidden');
    }, 3000);
  }

  async loadFromJsonFile() {
    const file = this.jsonFileInput.files[0];
    if (!file) {
      this.showStatus('JSONファイルを選択してください', 'error');
      return;
    }

    try {
      const text = await this.readFileAsText(file);
      const groupsData = JSON.parse(text);
      
      if (!Array.isArray(groupsData)) {
        throw new Error('JSONファイルは配列形式である必要があります');
      }

      const result = await this.sendMessage('createGroupsFromJSON', { data: groupsData });
      
      if (result.success) {
        this.showStatus(`${result.groups.length}個のタブグループを作成しました`);
        this.loadCurrentGroups();
      } else {
        this.showStatus(`エラー: ${result.error}`, 'error');
      }
    } catch (error) {
      this.showStatus(`ファイル読み込みエラー: ${error.message}`, 'error');
    }
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('ファイル読み込みに失敗しました'));
      reader.readAsText(file);
    });
  }


  async loadCurrentGroups() {
    try {
      const result = await this.sendMessage('getAllGroups');
      
      if (result.success) {
        this.displayGroups(result.groups);
      } else {
        this.groupsList.innerHTML = `<div>エラー: ${result.error}</div>`;
      }
    } catch (error) {
      this.groupsList.innerHTML = `<div>エラー: ${error.message}</div>`;
    }
  }

  displayGroups(groups) {
    if (groups.length === 0) {
      this.groupsList.innerHTML = '<div>タブグループがありません</div>';
      return;
    }

    this.groupsList.innerHTML = groups.map(group => {
      const colorDot = `<span style="display: inline-block; width: 12px; height: 12px; background-color: ${this.getColorCode(group.color)}; border-radius: 50%; margin-right: 8px;"></span>`;
      
      return `
        <div class="group-item">
          <div class="group-info">
            <div class="group-name">
              ${colorDot}${group.title || '無題のグループ'}
            </div>
            <div class="group-details">
              ${group.tabs.length}個のタブ
            </div>
          </div>
          <div class="button-group">
            <button class="export-btn" data-group-id="${group.id}">
              エクスポート
            </button>
            <button class="delete-btn danger" data-group-id="${group.id}">
              削除
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.attachGroupEventListeners();
  }

  attachGroupEventListeners() {
    const exportButtons = this.groupsList.querySelectorAll('.export-btn');
    const deleteButtons = this.groupsList.querySelectorAll('.delete-btn');

    exportButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const groupId = parseInt(e.target.getAttribute('data-group-id'));
        this.exportGroup(groupId);
      });
    });

    deleteButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const groupId = parseInt(e.target.getAttribute('data-group-id'));
        this.deleteGroup(groupId);
      });
    });
  }

  getColorCode(color) {
    const colors = {
      'grey': '#9aa0a6',
      'blue': '#1a73e8',
      'red': '#d93025',
      'yellow': '#fbbc04',
      'green': '#34a853',
      'pink': '#ff6d01',
      'purple': '#9c27b0',
      'cyan': '#00acc1'
    };
    return colors[color] || colors['blue'];
  }

  async deleteGroup(groupId) {
    if (!confirm('このタブグループを削除しますか？')) {
      return;
    }

    try {
      const result = await this.sendMessage('deleteGroup', { groupId });
      
      if (result.success) {
        this.showStatus('タブグループを削除しました');
        this.loadCurrentGroups();
      } else {
        this.showStatus(`削除エラー: ${result.error}`, 'error');
      }
    } catch (error) {
      this.showStatus(`削除エラー: ${error.message}`, 'error');
    }
  }

  async exportGroup(groupId) {
    try {
      const result = await this.sendMessage('getAllGroups');
      
      if (result.success) {
        const group = result.groups.find(g => g.id === groupId);
        if (!group) {
          this.showStatus('グループが見つかりません', 'error');
          return;
        }

        const groupData = {
          groupName: group.title || '無題のグループ',
          color: group.color,
          tabs: group.tabs.map(tab => tab.url)
        };

        const fileName = `${this.sanitizeFileName(group.title || '無題のグループ')}.json`;
        this.downloadJSON([groupData], fileName);
        this.showStatus(`「${group.title}」をエクスポートしました`);
      } else {
        this.showStatus(`グループ取得エラー: ${result.error}`, 'error');
      }
    } catch (error) {
      this.showStatus(`エクスポートエラー: ${error.message}`, 'error');
    }
  }

  async exportAllGroups() {
    try {
      const result = await this.sendMessage('getAllGroups');
      
      if (result.success) {
        if (result.groups.length === 0) {
          this.showStatus('エクスポートするグループがありません', 'error');
          return;
        }

        const groupsData = result.groups.map(group => ({
          groupName: group.title || '無題のグループ',
          color: group.color,
          tabs: group.tabs.map(tab => tab.url)
        }));

        const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
        const fileName = `tab-groups-${timestamp}.json`;
        this.downloadJSON(groupsData, fileName);
        this.showStatus(`${result.groups.length}個のグループをエクスポートしました`);
      } else {
        this.showStatus(`グループ取得エラー: ${result.error}`, 'error');
      }
    } catch (error) {
      this.showStatus(`エクスポートエラー: ${error.message}`, 'error');
    }
  }

  downloadJSON(data, filename) {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  sanitizeFileName(filename) {
    return filename.replace(/[<>:"/\\|?*]/g, '_').trim();
  }
}

const popupUI = new PopupUI();