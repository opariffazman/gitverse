import 'virtual:uno.css';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { hydrate } from '$store/engine';

const target = document.getElementById('app')!;

// Restore the previous session from IndexedDB before first paint, so the
// graph and terminal render already-populated and no early command can
// race the restore. hydrate() never rejects (errors are swallowed at the
// storage boundary), so mount always runs.
void hydrate().finally(() => {
  mount(App, { target });
});
