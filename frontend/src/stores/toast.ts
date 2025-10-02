import { defineStore } from "pinia";
import type { ToastMessageOptions, ToastServiceMethods } from "primevue";

export const useGlobalToast = defineStore("global-toast", {
    state: () => {
        return {
            toast: undefined as ToastServiceMethods | undefined
        }
    },

    actions: {
        setToast(toast: ToastServiceMethods) {
            this.toast = toast
        },

        add(msg: ToastMessageOptions) {
            this.toast!.add(msg)
        }
    }
})