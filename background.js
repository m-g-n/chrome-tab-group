class TabGroupManager {
  constructor() {
    this.initializeListeners();
  }

  initializeListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'createGroupsFromJSON':
          this.createGroupsFromJSON(request.data).then(sendResponse);
          return true;
        case 'getAllGroups':
          this.getAllGroups().then(sendResponse);
          return true;
        case 'deleteGroup':
          this.deleteGroup(request.groupId).then(sendResponse);
          return true;
      }
    });
  }

  async createGroupsFromJSON(groupsData) {
    try {
      const results = [];
      
      for (const groupData of groupsData) {
        const tabIds = [];
        
        for (const url of groupData.tabs) {
          const tab = await chrome.tabs.create({ url, active: false });
          tabIds.push(tab.id);
        }
        
        if (tabIds.length > 0) {
          const groupId = await chrome.tabs.group({ tabIds });
          await chrome.tabGroups.update(groupId, {
            title: groupData.groupName,
            color: groupData.color || 'blue'
          });
          
          results.push({
            groupId,
            name: groupData.groupName,
            color: groupData.color || 'blue',
            tabCount: tabIds.length
          });
        }
      }
      
      return { success: true, groups: results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getAllGroups() {
    try {
      const groups = await chrome.tabGroups.query({});
      const groupsWithTabs = [];
      
      for (const group of groups) {
        const tabs = await chrome.tabs.query({ groupId: group.id });
        groupsWithTabs.push({
          id: group.id,
          title: group.title,
          color: group.color,
          collapsed: group.collapsed,
          tabs: tabs.map(tab => ({
            id: tab.id,
            title: tab.title,
            url: tab.url
          }))
        });
      }
      
      return { success: true, groups: groupsWithTabs };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteGroup(groupId) {
    try {
      const tabs = await chrome.tabs.query({ groupId });
      const tabIds = tabs.map(tab => tab.id);
      
      if (tabIds.length > 0) {
        await chrome.tabs.remove(tabIds);
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

}

const tabGroupManager = new TabGroupManager();