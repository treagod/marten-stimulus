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
