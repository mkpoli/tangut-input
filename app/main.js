// Tangut Input: find a Tangut character by any of its names, read its record, and put it to use.
import { mount } from 'svelte'
import App from './App.svelte'
import './app.css'

mount(App, { target: /** @type {HTMLElement} */ (document.getElementById('app')) })
