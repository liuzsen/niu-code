import type { App } from "vue"
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import Aura from '@primeuix/themes/aura';
import { definePreset } from "@primeuix/themes";


const MyPreset = definePreset(Aura, {
    components: {
        textarea: {
            colorScheme: {
                light: {
                    root: {
                        shadow: "none"
                    },
                },
                dark: {
                    root: {
                        shadow: "none"
                    },
                }
            }
        }
    }
});


export function usePrimeVue(app: App<Element>) {
    app.use(PrimeVue, {
        theme: {
            preset: MyPreset,
            options: {
                cssLayer: {
                    name: 'primevue',
                    order: 'theme, base, primevue'
                },
                darkModeSelector: '.my-app-dark',
            }
        },
    })
    app.use(ToastService)
}