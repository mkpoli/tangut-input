// Tangut Input: find and enter a Tangut character by Cangjie code, reconstruction, meaning or
// component. The chosen character's record follows, with its description built from parts.
import { mount } from 'svelte'
import App from './App.svelte'
import './app.css'

mount(App, { target: /** @type {HTMLElement} */ (document.getElementById('app')) })
