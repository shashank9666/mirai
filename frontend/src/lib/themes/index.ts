import { IDETheme } from '../../store/themeStore';
import catppuccinMocha from './catppuccin-mocha.json';
import vscodeDark from './vscode-dark.json';
import miraiDark from './mirai-dark.json';
import miraiLight from './mirai-light.json';
import draculaTheme from './dracula.json';
import tokyoNightTheme from './tokyo-night.json';

export const builtinThemes: IDETheme[] = [
  catppuccinMocha as IDETheme,
  vscodeDark as IDETheme,
  miraiDark as IDETheme,
  miraiLight as IDETheme,
  draculaTheme as IDETheme,
  tokyoNightTheme as IDETheme,
];
