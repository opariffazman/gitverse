import eslintPluginSvelte from 'eslint-plugin-svelte';

export default [
  ...eslintPluginSvelte.configs['flat/recommended'],
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '.svelte-kit/'],
  },
];
