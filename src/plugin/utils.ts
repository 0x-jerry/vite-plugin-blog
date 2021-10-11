import path from 'path'
import fs from 'fs-extra'

export function transformRelativePath(filePath: string, sourcePath: string, distPath: string) {
  if (isAbsolutePath(filePath)) {
    return filePath
  }

  const abs = path.resolve(path.parse(sourcePath).dir, filePath)

  if (!fs.pathExistsSync(abs)) {
    return filePath
  }

  const outDir = path.parse(distPath).dir
  const relativeSrc = path.relative(outDir, abs)

  return relativeSrc
}

export function isAbsolutePath(p: string) {
  return path.isAbsolute(p) || /^https?:\/\//.test(p)
}

export function replaceTag(document: Document, node: Element, tagName: string) {
  const newNode = document.createElement(tagName)

  const attrs = node.getAttributeNames()

  for (const attr of attrs) {
    newNode.setAttribute(attr, node.getAttribute(attr)!)
  }

  node.childNodes.forEach((n) => newNode.appendChild(n))

  node.parentElement?.replaceChild(newNode, node)

  return newNode
}
