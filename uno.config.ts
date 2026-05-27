import { defineConfig, presetUno, presetIcons } from 'unocss';

export default defineConfig({
  presets: [presetUno(), presetIcons()],
  theme: {
    colors: {
      terminal: {
        bg: '#0d1117',
        fg: '#c9d1d9',
        dim: '#484f58',
        green: '#3fb950',
        red: '#f85149',
        yellow: '#d29922',
        blue: '#58a6ff',
        purple: '#bc8cff',
        cyan: '#39d353',
        grey: '#8b949e',
      },
    },
    fontFamily: {
      mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace",
    },
  },
  shortcuts: {
    'terminal-panel': 'rounded-lg border border-terminal-dim/30',
  },
});
