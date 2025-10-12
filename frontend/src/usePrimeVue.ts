import type { App } from "vue"
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import Aura from '@primeuix/themes/aura';

export function usePrimeVue(app: App<Element>) {
    app.use(PrimeVue, {
        theme: {
            preset: Aura,
            options: {
                cssLayer: {
                    name: 'primevue',
                    order: 'theme, base, primevue'
                },
            }
        },
    })
    app.use(ToastService)
}