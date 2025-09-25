// 假设原始类型是这样定义的（基于你提供的片段）
type ToolInputSchemasWithName = {
    tool_name: "Bash"
    input: BashInput
} | {
    tool_name: "Edit"
    input: FileEditInput
} | {
    tool_name: "Glob",
    input: GlobInput
} | {
    tool_name: "Grep"
    input: GrepInput
} | {
    tool_name: "MultiEdit"
    input: FileMultiEditInput
} | {
    tool_name: "NotebookEdit"
    input: NotebookEditInput
} | {
    tool_name: "Read"
    input: FileReadInput
} | {
    tool_name: "TodoWrite"
    input: TodoWriteInput
} | {
    tool_name: "WebFetch"
    input: WebFetchInput
} | {
    tool_name: "WebSearch"
    input: WebSearchInput
} | {
    tool_name: "Write"
    input: FileWriteInput
} | {
    tool_name: "Agent"
    input: AgentInput
} | {
    tool_name: "BashOutput"
    input: BashOutputInput
} | {
    tool_name: "ExitPlanMode"
    input: ExitPlanModeInput
} | {
    tool_name: "KillShell"
    input: KillShellInput
} | {
    tool_name: "ListMcpResources"
    input: ListMcpResourcesInput
} | {
    tool_name: "Mcp"
    input: McpInput
} | {
    tool_name: "ReadMcpResource"
    input: ReadMcpResourceInput
};

// 方法1: 使用条件映射类型
type RenameToolName<T> = T extends { tool_name: infer N; input: infer I }
  ? { name: N; input: I }
  : never;

type ToolInputSchemasWithNameField = RenameToolName<ToolInputSchemasWithName>;

// 方法2: 使用更简洁的映射
type ToolInputSchemasWithNameSimple = ToolInputSchemasWithName extends infer T
  ? T extends { tool_name: infer ToolName; input: infer InputType }
    ? { name: ToolName; input: InputType }
    : never
  : never;

// 使用示例
const example1: ToolInputSchemasWithNameField = {
  name: "Bash",
  input: {} as BashInput
};

const example2: ToolInputSchemasWithNameSimple = {
  name: "Read",
  input: {} as FileReadInput
};