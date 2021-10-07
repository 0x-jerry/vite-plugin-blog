export function replaceTag(document: Document, node: HTMLElement, tagName: string) {
  const newNode = document.createElement(tagName)

  const attrs = node.getAttributeNames()

  for (const attr of attrs) {
    newNode.setAttribute(attr, node.getAttribute(attr)!)
  }

  node.childNodes.forEach((n) => newNode.appendChild(n))

  node.parentElement?.replaceChild(newNode, node)
}
