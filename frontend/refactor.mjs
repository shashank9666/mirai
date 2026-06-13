import fs from 'fs';
import path from 'path';

const storesDef = {
    "useAiStore": ["aiProviders", "activeAiProviderId", "autoApproveSettings", "setAiProviderConfig", "setActiveAiProvider", "setAutoApproveSettings"],
    "useWorkspaceStore": ["workspacePath", "workspaceName", "recentWorkspaces", "setWorkspace", "clearWorkspace", "addRecentWorkspace"],
    "useSettingsStore": ["editorSettings", "setEditorSettings", "zoom", "setZoom", "extensions", "setExtensions", "zenMode", "toggleZenMode", "fullscreenMode", "toggleFullscreenMode", "notificationsEnabled", "toggleNotifications", "toggleWordWrap", "toggleMinimap", "toggleStickyScroll", "toggleFormatOnSave", "toggleBracketPairColorization", "toggleFolding", "increaseFontSize", "decreaseFontSize", "resetFontSize", "toggleMouseWheelZoom"],
    "useEditorStore": ["activeGroupId", "groups", "splitDirection", "diffMode", "diffOriginal", "diffModified", "diffFilePath", "getActiveGroup", "getGroupById", "setActiveFile", "closeTab", "closeAllTabs", "closeOtherTabs", "reopenClosedTab", "updateFileContent", "saveFile", "saveAllFiles", "revertFile", "renameTab", "reorderTabs", "toggleTabPin", "addGroup", "removeGroup", "setActiveGroup", "moveTabToGroup", "setSplitDirection", "openDiff", "closeDiff"]
};

const varToStore = {};
for (const [store, vars] of Object.entries(storesDef)) {
    for (const v of vars) {
        varToStore[v] = store;
    }
}

function processFile(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');
    let original = content;

    // 1. Handle `.getState()` replacements
    // e.g. useIdeStore.getState().toggleWordWrap() -> useSettingsStore.getState().toggleWordWrap()
    const getStateRegex = /useIdeStore\.getState\(\)\.([a-zA-Z0-9_]+)/g;
    content = content.replace(getStateRegex, (match, prop) => {
        const store = varToStore[prop];
        if (store) {
            return `${store}.getState().${prop}`;
        }
        return match;
    });

    // 2. Handle simple destructuring missed earlier (e.g., multiline or just missing the right regex)
    const destructureRegex = /const\s+\{([^}]+)\}\s*=\s*useIdeStore\(\)\s*;/g;
    content = content.replace(destructureRegex, (match, varsStr) => {
        const varsList = varsStr.split(',').map(v => v.trim()).filter(Boolean);
        const grouped = {};
        for (const v of varsList) {
            const realVar = v.split(':')[0].trim();
            const store = varToStore[realVar];
            if (store) {
                if (!grouped[store]) grouped[store] = [];
                grouped[store].push(v);
            }
        }
        let replacement = "";
        for (const [store, vList] of Object.entries(grouped)) {
            replacement += `  const { ${vList.join(', ')} } = ${store}();\n`;
        }
        return replacement.trim();
    });

    // 3. Handle `const store = useIdeStore();`
    // This requires replacing `store.prop` with the specific stores...
    // Actually, QuickOpen and CommandPalette do `store.groups`, `store.workspacePath` etc.
    // I can just replace `store.xyz` with `useEditorStore.getState().xyz` if we can't easily destructure.
    // Or I'll just skip 3 and do QuickOpen/CommandPalette manually.

    // 4. Update imports
    // Find what we need:
    const neededStores = new Set();
    const storeNames = Object.keys(storesDef);
    for (const store of storeNames) {
        if (content.includes(store)) {
            neededStores.add(store);
        }
    }

    if (neededStores.size > 0 && !content.includes(`import { ${Array.from(neededStores)[0]} }`)) {
        // Add imports
        let importLines = "";
        for (const s of neededStores) {
            let file = s.substring(3); // AiStore
            file = file.charAt(0).toLowerCase() + file.slice(1);
            if (!content.includes(`import { ${s} }`)) {
                importLines += `import { ${s} } from '@/store/${file}';\n`;
            }
        }
        
        // replace old import if it's there
        const oldImportRegex = /import\s+\{\s*useIdeStore(?:[^}]*)\}\s*from\s+['"]@\/store\/ideStore['"]\s*;/;
        if (oldImportRegex.test(content)) {
            // Wait, we might need EditorSettings or other types from ideStore!
            // Let's just append the new imports after the old one, and maybe we don't remove the old one if it exports types.
            content = content.replace(oldImportRegex, (m) => m + '\n' + importLines);
        } else {
            // just put it at the top
            content = importLines + '\n' + content;
        }
    }

    if (content !== original) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`Updated ${filepath}`);
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            processFile(fullPath);
        }
    }
}

walkDir('src');
