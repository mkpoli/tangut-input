// A page that is only the input method: the same component the site offers beside its fields, open
// on its own so a tool elsewhere can embed it as a picker.
//   /pick.html — a character picked here is posted to the embedding window as { type: 'tangut-pick' }.
import { mount } from 'svelte'
import Pick from './Pick.svelte'
import './app.css'

mount(Pick, { target: /** @type {HTMLElement} */ (document.getElementById('pick')) })
