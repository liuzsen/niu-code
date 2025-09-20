import type { App } from "vue"
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import Aura from '@primeuix/themes/aura';
import { definePreset } from "@primeuix/themes";

const MyPreset = definePreset(Aura, {
    semantic: {
        colorScheme: {
            light: {
                primary: {
                    50: "{neutral.50}",
                    100: "{neutral.100}",
                    200: "{neutral.200}",
                    300: "{neutral.300}",
                    400: "{neutral.400}",
                    500: "{neutral.500}",
                    600: "{neutral.600}",
                    700: "{neutral.700}",
                    800: "{neutral.800}",
                    900: "{neutral.900}",
                    950: "{neutral.950}",
                },
                surface: {
                    0: "#ffffff",
                    50: "{orange.50}",
                    100: "{orange.100}",
                    200: "{orange.200}",
                    300: "{orange.300}",
                    400: "{orange.400}",
                    500: "{orange.500}",
                    600: "{orange.600}",
                    700: "{orange.700}",
                    800: "{orange.800}",
                    900: "{orange.900}",
                    950: "{orange.950}",
                },
            },
            dark: {
                primary: {
                    50: "{orange.50}",
                    100: "{orange.100}",
                    200: "{orange.200}",
                    300: "{orange.300}",
                    400: "{orange.400}",
                    500: "{orange.500}",
                    600: "{orange.600}",
                    700: "{orange.700}",
                    800: "{orange.800}",
                    900: "{orange.900}",
                    950: "{orange.950}",
                },
                surface: {
                    0: "#ffffff",
                    50: "{zinc.50}",
                    100: "{zinc.100}",
                    200: "{zinc.200}",
                    300: "{zinc.300}",
                    400: "{zinc.400}",
                    500: "{zinc.500}",
                    600: "{zinc.600}",
                    700: "{zinc.700}",
                    800: "{zinc.800}",
                    900: "{zinc.900}",
                    950: "{zinc.950}",
                },
            },
        },
    },
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
        },
        card: {
            body: {
                padding: "0"
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
                darkModeSelector: '.p-dark',
            }
        },
    })
    app.use(ToastService)
}