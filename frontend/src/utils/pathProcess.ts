import { useWorkspace } from "../stores/workspace";

export function toRelativePath(path: string): string {
    const workspace = useWorkspace();
    const cwd = workspace.workingDirectory;
    if (!cwd) {
        return path;
    }
    const new_path = path.replace(cwd, "");
    if (new_path.startsWith("/")) {
        return new_path.substring(1);
    }
    return new_path;
}

export function extractFileName(filePath: string): string {
    return filePath.split('/').pop()?.split('\\').pop() || '';
}
