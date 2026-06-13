import { useEditorStore } from '@/store/editorStore';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';
import { EditorGroup, Tab, getLanguageFromPath } from './ideStore';

let groupCounter = 1;

interface EditorState {
  activeGroupId: string;
  groups: EditorGroup[];
  splitDirection: 'horizontal' | 'vertical';
  diffMode: boolean;
  diffOriginal: string;
  diffModified: string;
  diffFilePath: string;

  getActiveGroup: () => EditorGroup | undefined;
  getGroupById: (id: string) => EditorGroup | undefined;
  setActiveFile: (path: string, name: string, content: string) => void;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (id: string) => void;
  reopenClosedTab: () => void;
  updateFileContent: (content: string) => void;
  saveFile: (path?: string) => Promise<void>;
  saveAllFiles: () => Promise<void>;
  revertFile: (path?: string) => Promise<void>;
  renameTab: (oldPath: string, newPath: string) => void;
  reorderTabs: (groupId: string, draggedPath: string, targetPath: string) => void;
  toggleTabPin: (groupId: string, tabPath: string) => void;
  addGroup: (direction: 'horizontal' | 'vertical') => string;
  removeGroup: (groupId: string) => void;
  setActiveGroup: (groupId: string) => void;
  moveTabToGroup: (tabPath: string, fromGroupId: string, toGroupId: string) => void;
  setSplitDirection: (dir: 'horizontal' | 'vertical') => void;
  openDiff: (filePath: string, original: string, modified: string) => void;
  closeDiff: () => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      activeGroupId: 'group-1',
      groups: [{
        id: 'group-1',
        activeFile: null,
        activeFileContent: '',
        tabs: [],
        closedTabs: [],
      }],
      splitDirection: 'horizontal',
      diffMode: false,
      diffOriginal: '',
      diffModified: '',
      diffFilePath: '',

      getActiveGroup: () => {
        const state = get();
        return state.groups.find((g) => g.id === state.activeGroupId);
      },

      getGroupById: (id: string) => {
        return get().groups.find((g) => g.id === id);
      },

      setActiveFile: (path, name, content) => set((state) => {
        const lang = getLanguageFromPath(path);
        const groupIndex = state.groups.findIndex((g) => g.id === state.activeGroupId);
        if (groupIndex === -1) return {};

        const group = state.groups[groupIndex];
        const existingTab = group.tabs.find((t) => t.path === path);
        const newTabs = existingTab
          ? group.tabs
          : [...group.tabs, { id: path, name, path, dirty: false, savedContent: content, editedContent: content, language: lang }];
        const newContent = existingTab ? (existingTab.editedContent || content) : content;

        const newGroups = [...state.groups];
        newGroups[groupIndex] = { ...group, tabs: newTabs, activeFile: path, activeFileContent: newContent };

        return { groups: newGroups };
      }),

      closeTab: (id) => set((state) => {
        const groupIndex = state.groups.findIndex((g) => g.id === state.activeGroupId);
        if (groupIndex === -1) return {};

        const group = state.groups[groupIndex];
        const closedTab = group.tabs.find((t) => t.id === id);
        const newTabs = group.tabs.filter((t) => t.id !== id);
        const newActiveFile = group.activeFile === id
          ? (newTabs.length > 0 ? newTabs[newTabs.length - 1].path : null)
          : group.activeFile;
        const newActiveContent = newActiveFile
          ? (newTabs.find(t => t.path === newActiveFile)?.editedContent || '')
          : '';
        const newClosedTabs = closedTab
          ? [{ name: closedTab.name, path: closedTab.path }, ...group.closedTabs].slice(0, 50)
          : group.closedTabs;

        const newGroups = [...state.groups];
        newGroups[groupIndex] = { ...group, tabs: newTabs, activeFile: newActiveFile, activeFileContent: newActiveContent, closedTabs: newClosedTabs };

        return { groups: newGroups };
      }),

      closeAllTabs: () => set((state) => {
        const groupIndex = state.groups.findIndex((g) => g.id === state.activeGroupId);
        if (groupIndex === -1) return {};
        const newGroups = [...state.groups];
        newGroups[groupIndex] = { ...newGroups[groupIndex], tabs: [], activeFile: null, activeFileContent: '' };
        return { groups: newGroups };
      }),

      closeOtherTabs: (id) => set((state) => {
        const groupIndex = state.groups.findIndex((g) => g.id === state.activeGroupId);
        if (groupIndex === -1) return {};
        const group = state.groups[groupIndex];
        const kept = group.tabs.find(t => t.id === id);
        const newGroups = [...state.groups];
        newGroups[groupIndex] = {
          ...group,
          tabs: kept ? [kept] : [],
          activeFile: kept ? kept.path : null,
          activeFileContent: kept ? kept.editedContent : '',
        };
        return { groups: newGroups };
      }),

      reopenClosedTab: () => set((state) => {
        const groupIndex = state.groups.findIndex((g) => g.id === state.activeGroupId);
        if (groupIndex === -1) return {};
        const group = state.groups[groupIndex];
        if (group.closedTabs.length === 0) return {};
        const [next, ...rest] = group.closedTabs;
        const exists = group.tabs.find(t => t.path === next.path);
        if (exists) {
          const newGroups = [...state.groups];
          newGroups[groupIndex] = { ...group, closedTabs: rest };
          return { groups: newGroups };
        }
        const lang = getLanguageFromPath(next.path);
        const newGroups = [...state.groups];
        newGroups[groupIndex] = {
          ...group,
          closedTabs: rest,
          tabs: [...group.tabs, { id: next.path, name: next.name, path: next.path, dirty: false, savedContent: '', editedContent: '', language: lang }],
          activeFile: next.path,
        };
        return { groups: newGroups };
      }),

      updateFileContent: (content) => set((state) => {
        const groupIndex = state.groups.findIndex((g) => g.id === state.activeGroupId);
        if (groupIndex === -1) return {};
        const group = state.groups[groupIndex];
        const newTabs = group.tabs.map(t =>
          t.path === group.activeFile
            ? { ...t, dirty: content !== t.savedContent, editedContent: content }
            : t
        );
        const newGroups = [...state.groups];
        newGroups[groupIndex] = { ...group, activeFileContent: content, tabs: newTabs };
        return { groups: newGroups };
      }),

      saveFile: async (path?: string) => {
        const state = get();
        const groupIndex = state.groups.findIndex((g) => g.id === state.activeGroupId);
        if (groupIndex === -1) return;
        const group = state.groups[groupIndex];
        const targetPath = path || group.activeFile;
        if (!targetPath) return;
        const tab = group.tabs.find(t => t.path === targetPath);
        if (!tab) return;
        const content = targetPath === group.activeFile ? group.activeFileContent : tab.editedContent;
        try {
          await api.writeFile(targetPath, content);
          set((s) => {
            const gi = s.groups.findIndex((g) => g.id === s.activeGroupId);
            if (gi === -1) return {};
            const newGroups = [...s.groups];
            newGroups[gi] = {
              ...newGroups[gi],
              tabs: newGroups[gi].tabs.map(t => t.path === targetPath ? { ...t, dirty: false, savedContent: content, editedContent: content } : t),
            };
            return { groups: newGroups };
          });
        } catch (err) {
          console.error('Save failed:', err);
        }
      },

      saveAllFiles: async () => {
        const state = get();
        const group = state.groups.find(g => g.id === state.activeGroupId);
        if (!group) return;
        for (const tab of group.tabs) {
          if (tab.dirty) {
            const content = tab.path === group.activeFile ? group.activeFileContent : tab.editedContent;
            try {
              await api.writeFile(tab.path, content);
            } catch (err) {
              console.error(`Save failed for ${tab.path}:`, err);
            }
          }
        }
        set((s) => {
          const gi = s.groups.findIndex((g) => g.id === s.activeGroupId);
          if (gi === -1) return {};
          const newGroups = [...s.groups];
          newGroups[gi] = {
            ...newGroups[gi],
            tabs: newGroups[gi].tabs.map(t => ({ ...t, dirty: false, savedContent: t.path === newGroups[gi].activeFile ? newGroups[gi].activeFileContent : t.editedContent })),
          };
          return { groups: newGroups };
        });
      },

      revertFile: async (path?: string) => {
        const state = get();
        const groupIndex = state.groups.findIndex((g) => g.id === state.activeGroupId);
        if (groupIndex === -1) return;
        const group = state.groups[groupIndex];
        const targetPath = path || group.activeFile;
        if (!targetPath) return;
        try {
          const { content } = await api.readFile(targetPath);
          set((s) => {
            const gi = s.groups.findIndex((g) => g.id === s.activeGroupId);
            if (gi === -1) return {};
            const newGroups = [...s.groups];
            newGroups[gi] = {
              ...newGroups[gi],
              activeFileContent: targetPath === newGroups[gi].activeFile ? content : newGroups[gi].activeFileContent,
              tabs: newGroups[gi].tabs.map(t => t.path === targetPath ? { ...t, dirty: false, savedContent: content, editedContent: content } : t),
            };
            return { groups: newGroups };
          });
        } catch (err) {
          console.error('Revert failed:', err);
        }
      },

      renameTab: (oldPath, newPath) => set((state) => {
        const newGroups = state.groups.map(g => ({
          ...g,
          tabs: g.tabs.map(t => t.path === oldPath ? { ...t, id: newPath, path: newPath, language: getLanguageFromPath(newPath) } : t),
          activeFile: g.activeFile === oldPath ? newPath : g.activeFile,
        }));
        return { groups: newGroups };
      }),

      reorderTabs: (groupId, draggedPath, targetPath) => set((state) => {
        if (draggedPath === targetPath) return {};
        const groupIndex = state.groups.findIndex(g => g.id === groupId);
        if (groupIndex === -1) return {};
        const group = state.groups[groupIndex];
        const newTabs = [...group.tabs];
        const draggedIdx = newTabs.findIndex(t => t.path === draggedPath);
        const targetIdx = newTabs.findIndex(t => t.path === targetPath);
        if (draggedIdx === -1 || targetIdx === -1) return {};

        const [draggedTab] = newTabs.splice(draggedIdx, 1);
        newTabs.splice(targetIdx, 0, draggedTab);

        newTabs.sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));

        const newGroups = [...state.groups];
        newGroups[groupIndex] = { ...group, tabs: newTabs };
        return { groups: newGroups };
      }),

      toggleTabPin: (groupId, tabPath) => set((state) => {
        const groupIndex = state.groups.findIndex(g => g.id === groupId);
        if (groupIndex === -1) return {};
        const group = state.groups[groupIndex];
        const newTabs = group.tabs.map(t => t.path === tabPath ? { ...t, pinned: !t.pinned } : t);

        newTabs.sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));

        const newGroups = [...state.groups];
        newGroups[groupIndex] = { ...group, tabs: newTabs };
        return { groups: newGroups };
      }),

      addGroup: (direction) => {
        const newId = `group-${++groupCounter}`;
        set((state) => {
          const newGroup: EditorGroup = {
            id: newId,
            activeFile: null,
            activeFileContent: '',
            tabs: [],
            closedTabs: [],
          };
          return {
            groups: [...state.groups, newGroup],
            activeGroupId: newId,
            splitDirection: direction,
          };
        });
        return newId;
      },

      removeGroup: (groupId) => set((state) => {
        if (state.groups.length <= 1) return {};
        const newGroups = state.groups.filter(g => g.id !== groupId);
        const newActiveId = state.activeGroupId === groupId
          ? newGroups[newGroups.length - 1].id
          : state.activeGroupId;
        return { groups: newGroups, activeGroupId: newActiveId };
      }),

      setActiveGroup: (groupId) => set(() => ({ activeGroupId: groupId })),

      moveTabToGroup: (tabPath, fromGroupId, toGroupId) => set((state) => {
        const fromIndex = state.groups.findIndex(g => g.id === fromGroupId);
        const toIndex = state.groups.findIndex(g => g.id === toGroupId);
        if (fromIndex === -1 || toIndex === -1) return {};

        const fromGroup = state.groups[fromIndex];
        const tab = fromGroup.tabs.find(t => t.path === tabPath);
        if (!tab) return {};

        const newGroups = [...state.groups];
        newGroups[fromIndex] = {
          ...fromGroup,
          tabs: fromGroup.tabs.filter(t => t.path !== tabPath),
          activeFile: fromGroup.activeFile === tabPath
            ? (fromGroup.tabs.filter(t => t.path !== tabPath).length > 0
              ? fromGroup.tabs.filter(t => t.path !== tabPath)[fromGroup.tabs.filter(t => t.path !== tabPath).length - 1].path
              : null)
            : fromGroup.activeFile,
        };

        const toGroup = newGroups[toIndex];
        const existsInTarget = toGroup.tabs.find(t => t.path === tabPath);
        if (!existsInTarget) {
          newGroups[toIndex] = {
            ...toGroup,
            tabs: [...toGroup.tabs, tab],
          };
        }

        return { groups: newGroups };
      }),

      setSplitDirection: (dir) => set(() => ({ splitDirection: dir })),

      openDiff: (filePath, original, modified) => set(() => ({
        diffMode: true,
        diffFilePath: filePath,
        diffOriginal: original,
        diffModified: modified,
      })),

      closeDiff: () => set(() => ({
        diffMode: false,
        diffFilePath: '',
        diffOriginal: '',
        diffModified: '',
      })),
    }),
    {
      name: 'mirai-editor-storage',
      partialize: (state) => ({
        groups: state.groups,
        activeGroupId: state.activeGroupId,
        splitDirection: state.splitDirection,
      }),
    }
  )
);
