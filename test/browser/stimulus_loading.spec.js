const { test, expect } = require("@playwright/test")

test("imports the Stimulus loader exports", async ({ page }) => {
  await page.goto("/test/browser/fixtures/index.html")

  await expect.poll(() => page.evaluate(() => ({
    eagerLoadControllersFrom: typeof window.stimulusLoadingExports?.eagerLoadControllersFrom,
    lazyLoadControllersFrom: typeof window.stimulusLoadingExports?.lazyLoadControllersFrom,
  }))).toEqual({
    eagerLoadControllersFrom: "function",
    lazyLoadControllersFrom: "function",
  })
})

test("eagerly registers valid controller modules with Stimulus identifiers", async ({ page }) => {
  await page.goto("/test/browser/fixtures/index.html")

  const result = await page.evaluate(async () => {
    window.controllerImports = {}
    const modulesByIdentifier = new Map()
    const application = {
      router: { modulesByIdentifier },
      registrations: [],
      register(identifier, controller) {
        this.registrations.push({ identifier, controllerName: controller.name })
        modulesByIdentifier.set(identifier, controller)
      },
    }

    await window.stimulusLoadingExports.eagerLoadControllersFrom("controllers", application)

    return {
      registrations: application.registrations,
      imports: window.controllerImports,
    }
  })

  expect(result.registrations.sort((left, right) => left.identifier.localeCompare(right.identifier))).toEqual([
    { identifier: "hello", controllerName: "HelloController" },
    { identifier: "my-form", controllerName: "MyFormController" },
    { identifier: "admin--user", controllerName: "UserController" },
  ].sort((left, right) => left.identifier.localeCompare(right.identifier)))
  expect(result.imports).toEqual({ hello: 1, myForm: 1, adminUser: 1 })
})

test("ignores non-controller and out-of-prefix import-map entries", async ({ page }) => {
  await page.goto("/test/browser/fixtures/index.html")

  const result = await page.evaluate(async () => {
    window.controllerImports = {}
    const application = {
      router: { modulesByIdentifier: new Map() },
      registrations: [],
      register(identifier) {
        this.registrations.push(identifier)
      },
    }

    await window.stimulusLoadingExports.eagerLoadControllersFrom("controllers", application)
    return { registrations: application.registrations, imports: window.controllerImports }
  })

  expect(result.registrations.sort()).toEqual(["admin--user", "hello", "my-form"])
  expect(result.imports).toEqual({ hello: 1, myForm: 1, adminUser: 1 })
})

test("does not import or register an already registered controller", async ({ page }) => {
  await page.goto("/test/browser/fixtures/index.html")

  const result = await page.evaluate(async () => {
    window.controllerImports = {}
    const modulesByIdentifier = new Map([["hello", {}]])
    const application = {
      router: { modulesByIdentifier },
      registrations: [],
      register(identifier) {
        this.registrations.push(identifier)
      },
    }

    await window.stimulusLoadingExports.eagerLoadControllersFrom("controllers", application)
    return { registrations: application.registrations, imports: window.controllerImports }
  })

  expect(result.registrations).not.toContain("hello")
  expect(result.imports.hello).toBeUndefined()
})

test("includes the identifier and import-map path when an import fails", async ({ page }) => {
  await page.goto("/test/browser/fixtures/error.html")

  const message = await page.evaluate(async () => {
    const application = { router: { modulesByIdentifier: new Map() }, register() {} }

    try {
      await window.stimulusLoadingExports.eagerLoadControllersFrom("controllers", application)
    } catch (error) {
      return error.message
    }

    return null
  })

  expect(message).toContain("missing")
  expect(message).toContain("controllers/missing_controller")
})

test("lazy-loads controllers already present in the document", async ({ page }) => {
  await page.goto("/test/browser/fixtures/index.html")

  await page.evaluate(() => {
    window.controllerImports = {}
    const existing = document.createElement("div")
    existing.dataset.controller = "hello"
    document.body.append(existing)

    const modulesByIdentifier = new Map()
    const application = {
      router: { modulesByIdentifier },
      registrations: [],
      register(identifier, controller) {
        this.registrations.push(identifier)
        modulesByIdentifier.set(identifier, controller)
      },
    }

    window.lazyApplication = application
    window.stimulusLoadingExports.lazyLoadControllersFrom("controllers", application)
  })

  await expect.poll(() => page.evaluate(() => window.lazyApplication.registrations)).toEqual(["hello"])
  expect(await page.evaluate(() => window.controllerImports)).toEqual({ hello: 1 })
})

test("loads multiple identifiers with arbitrary whitespace and nested names", async ({ page }) => {
  await page.goto("/test/browser/fixtures/index.html")

  await page.evaluate(() => {
    window.controllerImports = {}
    const existing = document.createElement("div")
    existing.setAttribute("data-controller", "hello \t my-form\nadmin--user")
    document.body.append(existing)

    const modulesByIdentifier = new Map()
    const application = {
      router: { modulesByIdentifier },
      registrations: [],
      register(identifier, controller) {
        this.registrations.push(identifier)
        modulesByIdentifier.set(identifier, controller)
      },
    }

    window.lazyApplication = application
    window.stimulusLoadingExports.lazyLoadControllersFrom("controllers", application)
  })

  await expect.poll(() => page.evaluate(() => window.lazyApplication.registrations.sort())).toEqual([
    "admin--user",
    "hello",
    "my-form",
  ])
  expect(await page.evaluate(() => window.controllerImports)).toEqual({
    hello: 1,
    myForm: 1,
    adminUser: 1,
  })
})

test("ignores unknown lazy controller identifiers", async ({ page }) => {
  await page.goto("/test/browser/fixtures/index.html")

  await page.evaluate(() => {
    window.controllerImports = {}
    const existing = document.createElement("div")
    existing.dataset.controller = "unknown hello"
    document.body.append(existing)

    const modulesByIdentifier = new Map()
    const application = {
      router: { modulesByIdentifier },
      registrations: [],
      register(identifier, controller) {
        this.registrations.push(identifier)
        modulesByIdentifier.set(identifier, controller)
      },
    }

    window.lazyApplication = application
    window.stimulusLoadingExports.lazyLoadControllersFrom("controllers", application)
  })

  await expect.poll(() => page.evaluate(() => window.lazyApplication.registrations)).toEqual(["hello"])
  expect(await page.evaluate(() => window.controllerImports)).toEqual({ hello: 1 })
})

test("does not import an already registered lazy controller", async ({ page }) => {
  await page.goto("/test/browser/fixtures/index.html")

  const result = await page.evaluate(() => {
    window.controllerImports = {}
    const existing = document.createElement("div")
    existing.dataset.controller = "hello"
    document.body.append(existing)

    const modulesByIdentifier = new Map([["hello", {}]])
    const application = {
      router: { modulesByIdentifier },
      registrations: [],
      register(identifier) {
        this.registrations.push(identifier)
      },
    }

    window.stimulusLoadingExports.lazyLoadControllersFrom("controllers", application)
    return { imports: window.controllerImports, registrations: application.registrations }
  })

  expect(result).toEqual({ imports: {}, registrations: [] })
})

test("limits the initial lazy scan to a supplied root", async ({ page }) => {
  await page.goto("/test/browser/fixtures/index.html")

  await page.evaluate(() => {
    window.controllerImports = {}
    const root = document.createElement("section")
    const inside = document.createElement("div")
    inside.dataset.controller = "my-form"
    root.append(inside)

    const outside = document.createElement("div")
    outside.dataset.controller = "hello"
    document.body.append(root, outside)

    const modulesByIdentifier = new Map()
    const application = {
      router: { modulesByIdentifier },
      registrations: [],
      register(identifier, controller) {
        this.registrations.push(identifier)
        modulesByIdentifier.set(identifier, controller)
      },
    }

    window.lazyApplication = application
    window.stimulusLoadingExports.lazyLoadControllersFrom("controllers", application, root)
  })

  await expect.poll(() => page.evaluate(() => window.lazyApplication.registrations)).toEqual(["my-form"])
  expect(await page.evaluate(() => window.controllerImports)).toEqual({ myForm: 1 })
})

test("scans the supplied root when it has a controller attribute", async ({ page }) => {
  await page.goto("/test/browser/fixtures/index.html")

  await page.evaluate(() => {
    window.controllerImports = {}
    const root = document.createElement("div")
    root.dataset.controller = "admin--user"
    document.body.append(root)

    const modulesByIdentifier = new Map()
    const application = {
      router: { modulesByIdentifier },
      registrations: [],
      register(identifier, controller) {
        this.registrations.push(identifier)
        modulesByIdentifier.set(identifier, controller)
      },
    }

    window.lazyApplication = application
    window.stimulusLoadingExports.lazyLoadControllersFrom("controllers", application, root)
  })

  await expect.poll(() => page.evaluate(() => window.lazyApplication.registrations)).toEqual(["admin--user"])
  expect(await page.evaluate(() => window.controllerImports)).toEqual({ adminUser: 1 })
})

test("loads a controller on a newly inserted element", async ({ page }) => {
  await page.goto("/test/browser/fixtures/index.html")

  await page.evaluate(() => {
    window.controllerImports = {}
    const modulesByIdentifier = new Map()
    const application = {
      router: { modulesByIdentifier },
      registrations: [],
      register(identifier, controller) {
        this.registrations.push(identifier)
        modulesByIdentifier.set(identifier, controller)
      },
    }

    window.lazyApplication = application
    window.stimulusLoadingExports.lazyLoadControllersFrom("controllers", application)

    const element = document.createElement("div")
    element.dataset.controller = "hello"
    document.body.append(element)
  })

  await expect.poll(() => page.evaluate(() => window.lazyApplication.registrations)).toEqual(["hello"])
})

test("loads controllers nested inside a newly inserted container", async ({ page }) => {
  await page.goto("/test/browser/fixtures/index.html")

  await page.evaluate(() => {
    window.controllerImports = {}
    const modulesByIdentifier = new Map()
    const application = {
      router: { modulesByIdentifier },
      registrations: [],
      register(identifier, controller) {
        this.registrations.push(identifier)
        modulesByIdentifier.set(identifier, controller)
      },
    }

    window.lazyApplication = application
    window.stimulusLoadingExports.lazyLoadControllersFrom("controllers", application)

    const container = document.createElement("section")
    const element = document.createElement("div")
    element.dataset.controller = "admin--user"
    container.append(element)
    document.body.append(container)
  })

  await expect.poll(() => page.evaluate(() => window.lazyApplication.registrations)).toEqual(["admin--user"])
})

test("loads a controller when data-controller is added", async ({ page }) => {
  await page.goto("/test/browser/fixtures/index.html")

  await page.evaluate(() => {
    window.controllerImports = {}
    const modulesByIdentifier = new Map()
    const application = {
      router: { modulesByIdentifier },
      registrations: [],
      register(identifier, controller) {
        this.registrations.push(identifier)
        modulesByIdentifier.set(identifier, controller)
      },
    }

    window.lazyApplication = application
    window.stimulusLoadingExports.lazyLoadControllersFrom("controllers", application)

    const element = document.createElement("div")
    document.body.append(element)
    element.setAttribute("data-controller", "my-form")
  })

  await expect.poll(() => page.evaluate(() => window.lazyApplication.registrations)).toEqual(["my-form"])
})

test("loads newly added identifiers when data-controller changes", async ({ page }) => {
  await page.goto("/test/browser/fixtures/index.html")

  await page.evaluate(() => {
    window.controllerImports = {}
    const element = document.createElement("div")
    element.dataset.controller = "hello"
    document.body.append(element)

    const modulesByIdentifier = new Map()
    const application = {
      router: { modulesByIdentifier },
      registrations: [],
      register(identifier, controller) {
        this.registrations.push(identifier)
        modulesByIdentifier.set(identifier, controller)
      },
    }

    window.lazyApplication = application
    window.lazyElement = element
    window.stimulusLoadingExports.lazyLoadControllersFrom("controllers", application)
  })

  await expect.poll(() => page.evaluate(() => window.lazyApplication.registrations)).toEqual(["hello"])

  await page.evaluate(() => window.lazyElement.setAttribute("data-controller", "hello my-form"))

  await expect.poll(() => page.evaluate(() => window.lazyApplication.registrations.sort())).toEqual([
    "hello",
    "my-form",
  ])
})

test("does not import a controller when data-controller is removed", async ({ page }) => {
  await page.goto("/test/browser/fixtures/index.html")

  await page.evaluate(() => {
    window.controllerImports = {}
    const element = document.createElement("div")
    element.dataset.controller = "hello"
    document.body.append(element)

    const modulesByIdentifier = new Map()
    const application = {
      router: { modulesByIdentifier },
      registrations: [],
      register(identifier, controller) {
        this.registrations.push(identifier)
        modulesByIdentifier.set(identifier, controller)
      },
    }

    window.lazyApplication = application
    window.lazyElement = element
    window.stimulusLoadingExports.lazyLoadControllersFrom("controllers", application)
  })

  await expect.poll(() => page.evaluate(() => window.lazyApplication.registrations)).toEqual(["hello"])
  await page.evaluate(() => window.lazyElement.removeAttribute("data-controller"))
  await page.waitForTimeout(50)

  expect(await page.evaluate(() => window.controllerImports)).toEqual({ hello: 1 })
  expect(await page.evaluate(() => window.lazyApplication.registrations)).toEqual(["hello"])
})

test("ignores text nodes added to the document", async ({ page }) => {
  await page.goto("/test/browser/fixtures/index.html")

  await page.evaluate(() => {
    window.controllerImports = {}
    const modulesByIdentifier = new Map()
    const application = {
      router: { modulesByIdentifier },
      registrations: [],
      register(identifier, controller) {
        this.registrations.push(identifier)
        modulesByIdentifier.set(identifier, controller)
      },
    }

    window.lazyApplication = application
    window.stimulusLoadingExports.lazyLoadControllersFrom("controllers", application)
    document.body.append(document.createTextNode('<div data-controller="hello"></div>'))
  })

  await page.waitForTimeout(50)
  expect(await page.evaluate(() => window.lazyApplication.registrations)).toEqual([])
  expect(await page.evaluate(() => window.controllerImports)).toEqual({})
})

test("registers a controller only once when it appears multiple times", async ({ page }) => {
  await page.goto("/test/browser/fixtures/index.html")

  await page.evaluate(() => {
    window.controllerImports = {}
    const modulesByIdentifier = new Map()
    const application = {
      router: { modulesByIdentifier },
      registrations: [],
      register(identifier, controller) {
        this.registrations.push(identifier)
        modulesByIdentifier.set(identifier, controller)
      },
    }

    window.lazyApplication = application
    window.stimulusLoadingExports.lazyLoadControllersFrom("controllers", application)

    const first = document.createElement("div")
    first.dataset.controller = "hello"
    const second = document.createElement("div")
    second.dataset.controller = "hello"
    document.body.append(first, second)
  })

  await expect.poll(() => page.evaluate(() => window.lazyApplication.registrations)).toEqual(["hello"])
  expect(await page.evaluate(() => window.controllerImports)).toEqual({ hello: 1 })
})

test("reports failed lazy imports with contextual console.error", async ({ page }) => {
  await page.goto("/test/browser/fixtures/dynamic_error.html")

  await page.evaluate(() => {
    window.lazyErrors = []
    console.error = (...args) => window.lazyErrors.push(args.map(String))

    const application = {
      router: { modulesByIdentifier: new Map() },
      register() {},
    }

    window.stimulusLoadingExports.lazyLoadControllersFrom("controllers", application)
    const element = document.createElement("div")
    element.dataset.controller = "missing"
    document.body.append(element)
  })

  await expect.poll(() => page.evaluate(() => window.lazyErrors.length)).toBe(1)
  const error = await page.evaluate(() => window.lazyErrors[0])
  expect(error[0]).toContain("missing")
  expect(error[0]).toContain("controllers/missing_controller")
  expect(error[1]).toMatch(/Error|failed/i)
})

test("continues observing valid mutations after a failed lazy import", async ({ page }) => {
  await page.goto("/test/browser/fixtures/dynamic_error.html")

  await page.evaluate(() => {
    window.lazyErrors = []
    console.error = (...args) => window.lazyErrors.push(args.map(String))

    const modulesByIdentifier = new Map()
    const application = {
      router: { modulesByIdentifier },
      registrations: [],
      register(identifier, controller) {
        this.registrations.push(identifier)
        modulesByIdentifier.set(identifier, controller)
      },
    }

    window.lazyApplication = application
    window.stimulusLoadingExports.lazyLoadControllersFrom("controllers", application)

    const missing = document.createElement("div")
    missing.dataset.controller = "missing"
    document.body.append(missing)
  })

  await expect.poll(() => page.evaluate(() => window.lazyErrors.length)).toBe(1)

  await page.evaluate(() => {
    const element = document.createElement("div")
    element.dataset.controller = "hello"
    document.body.append(element)
  })

  await expect.poll(() => page.evaluate(() => window.lazyApplication.registrations)).toEqual(["hello"])
})
