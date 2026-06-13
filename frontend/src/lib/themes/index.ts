import { IDETheme } from '../../store/themeStore';
import catppuccinMocha from './catppuccin-mocha.json';
import vscodeDark from './vscode-dark.json';

export const builtinThemes: IDETheme[] = [
  catppuccinMocha as IDETheme,
  vscodeDark as IDETheme,
];
