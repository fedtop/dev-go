/** 按 JSON Schema 生成参数模板（手动执行工具时预填），优先使用 const / default / examples */
export function templateFromSchema(schema: unknown, depth = 0): unknown {
  if (!schema || typeof schema !== 'object' || depth > 8) return null
  const node = schema as Record<string, unknown>

  if ('const' in node) return node.const
  if ('default' in node) return node.default
  if (Array.isArray(node.examples) && node.examples.length) return node.examples[0]
  const variants = (node.oneOf ?? node.anyOf) as unknown[] | undefined
  if (Array.isArray(variants) && variants.length) return templateFromSchema(variants[0], depth + 1)
  if (Array.isArray(node.enum) && node.enum.length) return node.enum[0]

  const type = Array.isArray(node.type) ? node.type[0] : node.type
  switch (type) {
    case 'object': {
      const properties = (node.properties ?? {}) as Record<string, unknown>
      return Object.fromEntries(
        Object.entries(properties).map(([key, value]) => [
          key,
          templateFromSchema(value, depth + 1),
        ]),
      )
    }
    case 'array':
      return node.items ? [templateFromSchema(node.items, depth + 1)] : []
    case 'string':
      if (node.format === 'date') return new Date().toISOString().slice(0, 10)
      if (node.format === 'date-time') return new Date().toISOString()
      if (node.format === 'email') return 'user@example.com'
      return ''
    case 'number':
    case 'integer':
      return typeof node.minimum === 'number' ? node.minimum : 0
    case 'boolean':
      return false
    case 'null':
      return null
    default:
      return node.properties ? templateFromSchema({ ...node, type: 'object' }, depth + 1) : {}
  }
}
