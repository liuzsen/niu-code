import { useChatStore } from "../stores/chat";

export function toRelativePath(path: string): string {
    const cwd = useChatStore().cwd;
    if (!cwd) {
        return path;
    }
    const new_path = path.replace(cwd, "");
    if (new_path.startsWith("/")) {
        return new_path.substring(1);
    }
    return new_path;
}