// Adapted from https://github.com/hotwired/stimulus-rails
// MIT License

export function eagerLoadControllersFrom(under, application) {
  const importMapJSON = document.querySelector("script[type=importmap]")?.textContent
  if (!importMapJSON) return

  const imports = JSON.parse(importMapJSON).imports || {}
  const prefix = `${under}/`

  const loading = new Set()
  const controllerImports = Object.keys(imports)
    .filter(m => {
      if (!m.startsWith(prefix)) return false
      return /^(?:[^/]+\/)*[^/]+_controller$/.test(m.slice(prefix.length))
    })
    .map(m => {
      const identifier = m
        .slice(prefix.length)
        .replace(/_controller$/, "")
        .replace(/_/g, "-")
        .replace(/\//g, "--")

      if (hasRegisteredController(application, identifier) || loading.has(identifier)) {
        return null
      }

      loading.add(identifier)

      return import(m)
        .catch(error => {
          throw new Error(
            `Failed to load controller "${identifier}" from "${m}"`,
            { cause: error },
          )
        })
        .then(module => {
          if (!hasRegisteredController(application, identifier)) {
            application.register(identifier, module.default)
          }
        })
    })
    .filter(Boolean)

  return Promise.all(controllerImports)
}

function hasRegisteredController(application, identifier) {
  const modulesByIdentifier = application.router?.modulesByIdentifier
  return typeof modulesByIdentifier?.has === "function" && modulesByIdentifier.has(identifier)
}

export function lazyLoadControllersFrom(under, application, element = document) {
  const importMapJSON = document.querySelector("script[type=importmap]")?.textContent
  if (!importMapJSON) return

  const imports = JSON.parse(importMapJSON).imports || {}
  const prefix = `${under}/`
  const loading = new Set()

  const scan = root => {
    if (root.nodeType === Node.ELEMENT_NODE && root.hasAttribute("data-controller")) {
      eachAttribute(root, under, application, imports, prefix, loading)
    }

    root.querySelectorAll("[data-controller]").forEach(el => {
      eachAttribute(el, under, application, imports, prefix, loading)
    })
  }

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return
        eachAttribute(node, under, application, imports, prefix, loading)
        node.querySelectorAll("[data-controller]").forEach(el => {
          eachAttribute(el, under, application, imports, prefix, loading)
        })
      })
    })
  })

  observer.observe(document.documentElement, { childList: true, subtree: true })
  scan(element)
}

function eachAttribute(el, under, application, imports, prefix, loading) {
  (el.getAttribute("data-controller") || "").trim().split(/\s+/).forEach(identifier => {
    if (!identifier) return
    const m = `${prefix}${identifier.replace(/--/g, "/").replace(/-/g, "_")}_controller`
    if (!imports[m] || hasRegisteredController(application, identifier) || loading.has(identifier)) return

    loading.add(identifier)
    import(m).then(module => {
      if (!hasRegisteredController(application, identifier)) {
        application.register(identifier, module.default)
      }
    }).finally(() => loading.delete(identifier))
  })
}
