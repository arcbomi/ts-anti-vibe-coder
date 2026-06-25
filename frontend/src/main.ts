import { createApp } from 'vue'

import App from './App.vue'
import { router } from './app/router'
import './index.css'

createApp(App).use(router).mount('#root')
