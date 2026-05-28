import 'virtual:uno.css';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { hydrate } from '$store/engine';

// Restore the previous session from IndexedDB before/while the UI mounts.
void hydrate();

const app = mount(App, { target: document.getElementById('app')! });

export default app;
