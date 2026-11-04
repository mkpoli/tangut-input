// A page that is only the character picker: the panel the Fanqie page opens, always open, so a tool
// elsewhere can embed it.
//   /pick.html — a character picked here is posted to the embedding window as { type: 'tangut-pick', char }.
import { mount } from 'svelte'
import Pick from './Pick.svelte'
import './app.css'

mount(Pick, { target: /** @type {HTMLElement} */ (document.getElementById('pick')) })
