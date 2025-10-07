import TurndownService from 'turndown'

// 创建 TurndownService 实例并配置
const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
  linkStyle: 'inlined',
  linkReferenceStyle: 'full'
})

// 配置规则以更好地处理 TipTap 生成的 HTML
turndownService.addRule('paragraph', {
  filter: 'p',
  replacement: (content) => {
    return content + '\n'
  }
})

// 处理代码块
turndownService.addRule('codeBlock', {
  filter: 'pre',
  replacement: (content, node) => {
    const codeElement = node.querySelector('code')
    let language = ''

    if (codeElement) {
      // 处理各种语言类名格式
      const classList = codeElement.className || ''
      const languageMatch = classList.match(/language-(\w+)/) || classList.match(/lang-(\w+)/)
      language = languageMatch ? languageMatch[1] : ''
    }

    // 清理内容，移除多余的空格和换行
    const cleanContent = content.trim()

    if (language) {
      return `\`\`\`${language}\n${cleanContent}\n\`\`\`\n\n`
    }
    return `\`\`\`\n${cleanContent}\n\`\`\`\n\n`
  }
})

// 处理行内代码
turndownService.addRule('inlineCode', {
  filter: (node): node is HTMLElement => node.nodeName === 'CODE' && !node.closest('pre'),
  replacement: (content) => {
    return `\`${content}\``
  }
})

// 处理代码块中的 code 元素
turndownService.addRule('codeInPre', {
  filter: (node): node is HTMLElement => node.nodeName === 'CODE' && !!node.closest('pre'),
  replacement: (content) => {
    return content
  }
})

// 处理表格
turndownService.addRule('tableRow', {
  filter: 'tr',
  replacement: (content) => {
    return content + '\n'
  }
})

// 处理表格单元格
turndownService.addRule('tableCell', {
  filter: ['th', 'td'],
  replacement: (content) => {
    return `| ${content.trim()} `
  }
})

// 处理无序列表项
turndownService.addRule('unorderedListItem', {
  filter: (node) => {
    return node.nodeName === 'LI' && node.parentNode?.nodeName === 'UL'
  },
  replacement: (content, node, options) => {
    content = content.trim()

    // 计算缩进级别
    let indent = ''
    let currentElement = node.parentNode

    // 向上遍历DOM树，计算嵌套深度
    while (currentElement && currentElement.nodeName === 'UL') {
      const parentElement = currentElement.parentNode
      if (parentElement && parentElement.nodeName === 'LI') {
        indent = '  ' + indent
        currentElement = parentElement.parentNode
      } else {
        break
      }
    }

    const prefix = indent + options.bulletListMarker + ' '
    return prefix + content + '\n'
  }
})

// 处理有序列表项
turndownService.addRule('orderedListItem', {
  filter: (node) => {
    return node.nodeName === 'LI' && node.parentNode?.nodeName === 'OL'
  },
  replacement: (content, node) => {
    content = content.trim()

    // 获取有序列表中的序号
    const parent = node.parentNode as HTMLOListElement
    const startIndex = parent.getAttribute('start') ? parseInt(parent.getAttribute('start')!) : 1
    const index = Array.from(parent.children).indexOf(node as Element) + startIndex

    // 计算缩进级别
    let indent = ''
    let currentElement: ParentNode | null = parent

    // 向上遍历DOM树，计算嵌套深度
    while (currentElement) {
      const parentElement: ParentNode | null = currentElement.parentNode
      if (parentElement && parentElement.nodeName === 'LI') {
        indent = '  ' + indent
        currentElement = parentElement.parentNode
      } else {
        break
      }
    }

    const prefix = indent + `${index}. `
    return prefix + content + '\n'
  }
})

// 处理换行
turndownService.addRule('lineBreak', {
  filter: 'br',
  replacement: () => {
    return '  \n'
  }
})

/**
 * 将 HTML 内容转换为 Markdown 格式
 * @param html HTML 字符串
 * @returns 转换后的 Markdown 字符串
 */
export function htmlToMarkdown(html: string): string {
  if (!html || html.trim() === '') {
    return ''
  }

  try {
    // 清理 HTML 内容
    // const cleanedHtml = cleanHtmlContent(html)

    // 执行转换
    const markdown = turndownService.turndown(html)

    // 后处理：清理多余的空行
    return markdown
      .replace(/\n{3,}/g, '\n\n')  // 将3个或更多换行符替换为2个
      .replace(/^\s+|\s+$/g, '')   // 移除首尾空格
      .trim()
  } catch (error) {
    console.error('HTML to Markdown conversion error:', error)
    // 如果转换失败，返回纯文本作为后备
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    return tempDiv.textContent || tempDiv.innerText || ''
  }
}

/**
 * 检查内容是否为纯文本（没有 HTML 标签）
 * @param content 内容字符串
 * @returns 如果是纯文本返回 true
 */
export function isPlainText(content: string): boolean {
  return !/<[a-z][\s\S]*>/i.test(content)
}