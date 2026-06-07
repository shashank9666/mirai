import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WindowType = 'explorer' | 'editor' | 'terminal' | 'chat' | 'settings' | 'history' | 'search' | 'cookbook' | 'compare';

export type LayoutNode = 
  | {
      id: string;
      type: 'split';
      direction: 'horizontal' | 'vertical';
      children: LayoutNode[];
    }
  | {
      id: string;
      type: 'leaf';
      windowType: WindowType;
      title: string;
      payload?: unknown;
    };

interface TilingLayoutStore {
  rootNode: LayoutNode | null;
  activeNodeId: string | null;
  isPinned: boolean;
  
  togglePin: () => void;
  spawnWindow: (windowType: WindowType, title?: string, payload?: unknown, customId?: string) => void;
  ensureWindow: (windowType: WindowType, title?: string, payload?: unknown) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  moveNode: (sourceId: string, targetId: string, position: 'top' | 'bottom' | 'left' | 'right') => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const findNode = (node: LayoutNode, id: string): LayoutNode | null => {
  if (node.id === id) return node;
  if (node.type === 'split') {
    for (const child of node.children) {
      const result = findNode(child, id);
      if (result) return result;
    }
  }
  return null;
};

const findNodeByType = (node: LayoutNode, type: WindowType): LayoutNode | null => {
  if (node.type === 'leaf' && node.windowType === type) return node;
  if (node.type === 'split') {
    for (const child of node.children) {
      const result = findNodeByType(child, type);
      if (result) return result;
    }
  }
  return null;
};

const removeNode = (node: LayoutNode, idToRemove: string): LayoutNode | null => {
  if (node.id === idToRemove) return null;
  
  if (node.type === 'split') {
    const newChildren = node.children
      .map(child => removeNode(child, idToRemove))
      .filter((child): child is LayoutNode => child !== null);
      
    if (newChildren.length === 0) return null;
    if (newChildren.length === 1) return newChildren[0]; 
    
    return { ...node, children: newChildren };
  }
  
  return node;
};

const defaultRoot: LayoutNode = {
  id: generateId(),
  type: 'split',
  direction: 'horizontal',
  children: [
    {
      id: 'default-explorer',
      type: 'leaf',
      windowType: 'explorer',
      title: 'Explorer',
    },
    {
      id: 'default-editor',
      type: 'leaf',
      windowType: 'editor',
      title: 'Editor',
    }
  ]
};

export const useWindowManagerStore = create<TilingLayoutStore>()(
  persist(
    (set, get) => ({
      rootNode: defaultRoot,
      activeNodeId: 'default-editor',
      isPinned: false,
      
      togglePin: () => set((state) => ({ isPinned: !state.isPinned })),

      spawnWindow: (windowType, title, payload, customId) => set((state) => {
        // Singleton Logic: If it's not an editor and it's already open, close it.
        if (windowType !== 'editor' && state.rootNode) {
          const existing = findNodeByType(state.rootNode, windowType);
          if (existing) {
            // Close it (toggle)
            return {
              rootNode: removeNode(state.rootNode, existing.id),
              activeNodeId: state.activeNodeId === existing.id ? null : state.activeNodeId
            };
          }
        }

        const currentRoot = state.rootNode;
        const currentActiveId = state.activeNodeId;

        const existingEditor = currentRoot ? findNodeByType(currentRoot, 'editor') : null;
        const newNodeId = customId || (windowType === 'editor' && !existingEditor ? 'default-editor' : generateId());

        const newNode: LayoutNode = {
          id: newNodeId,
          type: 'leaf',
          windowType,
          title: title || windowType,
          payload
        };

        if (!currentRoot) {
          return { rootNode: newNode, activeNodeId: newNode.id };
        }

        const targetId = currentActiveId || findNodeByType(currentRoot, 'editor')?.id;
        if (!targetId) {
          return { rootNode: newNode, activeNodeId: newNode.id };
        }

        const replaceNodeWithSplit = (node: LayoutNode): LayoutNode => {
          if (node.id === targetId) {
            return {
              id: generateId(),
              type: 'split',
              direction: 'horizontal',
              children: [node, newNode]
            };
          }
          if (node.type === 'split') {
            return {
              ...node,
              children: node.children.map(replaceNodeWithSplit)
            };
          }
          return node;
        };

        return {
          rootNode: replaceNodeWithSplit(currentRoot),
          activeNodeId: newNode.id
        };
      }),

      ensureWindow: (windowType, title, payload) => {
        const state = get();
        if (state.rootNode) {
          const existing = findNodeByType(state.rootNode, windowType);
          if (existing) {
            set({ activeNodeId: existing.id });
            return;
          }
        }
        state.spawnWindow(windowType, title, payload);
      },

      closeWindow: (id) => set((state) => {
        if (!state.rootNode) return state;
        const newRoot = removeNode(state.rootNode, id);
        return {
          rootNode: newRoot,
          activeNodeId: state.activeNodeId === id ? null : state.activeNodeId
        };
      }),

      focusWindow: (id) => set({ activeNodeId: id }),

      moveNode: (sourceId, targetId, position) => set((state) => {
        if (!state.rootNode || sourceId === targetId) return state;

        // 1. Find the source node and clone it
        const sourceNode = findNode(state.rootNode, sourceId);
        if (!sourceNode) return state;

        // 2. Remove source node from the tree
        const tempRoot = removeNode(state.rootNode, sourceId);
        if (!tempRoot) return state;

        // 3. Insert the source node at the target location
        const insertNode = (node: LayoutNode): LayoutNode => {
          if (node.id === targetId) {
            const isHorizontal = position === 'left' || position === 'right';
            const order = position === 'left' || position === 'top' 
                          ? [sourceNode, node] 
                          : [node, sourceNode];
                          
            return {
              id: generateId(),
              type: 'split',
              direction: isHorizontal ? 'horizontal' : 'vertical',
              children: order
            };
          }
          if (node.type === 'split') {
            return {
              ...node,
              children: node.children.map(insertNode)
            };
          }
          return node;
        };

        return {
          rootNode: insertNode(tempRoot),
          activeNodeId: sourceId
        };
      })
    }),
    {
      name: 'mirai-tiling-layout',
    }
  )
);
