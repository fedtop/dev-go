export function injectToNode(
  node: HTMLElement,
  tagName: keyof HTMLElementTagNameMap,
  text: string
) {
  // TODO 后续需要考虑将标签插入到合适的位置
  const transNode = document.createElement(tagName)
  const color = "#a4a4a4"
  transNode.className = "translate-node"
  transNode.style.cssText = `
    color: ${color};
    line-height: 1.5;
    display: block;
  `

  // 在节点中追加翻译后的内容
  transNode.innerHTML = text
  node.appendChild(transNode)
  // node.parentNode.insertBefore(newNode, node.nextSibling)
}
