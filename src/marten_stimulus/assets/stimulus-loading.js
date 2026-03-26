// Adapted from https://github.com/hotwired/stimulus-rails
// MIT License

export function eagerLoadControllersFrom(under, application) {
  const importMapJSON = document.querySelector("script[type=importmap]")?.textContent
  if (!importMapJSON) return

  const imports = JSON.parse(importMapJSON).imports || {}
  const prefix = `${under}/`

  Object.keys(imports)
    .filter(m => m.startsWith(prefix))
    .forEach(m => {
      const identifier = m
        .slice(prefix.length)
        .replace(/_controller$/, "")
        .replace(/_/g, "-")
        .replace(/\//g, "--")

      import(m).then(module => {
        application.register(identifier, module.default)
      })
    })
}

export function lazyLoadControllersFrom(under, application) {
  const importMapJSON = document.querySelector("script[type=importmap]")?.textContent
  if (!importMapJSON) return

  const imports = JSON.parse(importMapJSON).imports || {}
  const prefix = `${under}/`

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return
        eachAttribute(node, under, application, imports, prefix)
        node.querySelectorAll("[data-controller]").forEach(el => {
          eachAttribute(el, under, application, imports, prefix)
        })
      })
    })
  })

  observer.observe(document.documentElement, { childList: true, subtree: true })
}

function eachAttribute(el, under, application, imports, prefix) {
  (el.getAttribute("data-controller") || "").split(" ").forEach(identifier => {
    if (!identifier) return
    const m = `${prefix}${identifier.replace(/--/g, "/").replace(/-/g, "_")}_controller`
    if (imports[m]) {
      import(m).then(module => application.register(identifier, module.default))
    }
  })
}
