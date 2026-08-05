# MartenStimulus

[Hotwire Stimulus](https://stimulus.hotwired.dev) integration for [Marten](https://martenframework.com), built on top of [marten-importmap](https://github.com/treagod/marten-importmap).

Adding a Stimulus controller by hand means pinning it in the importmap and registering it with the application. This shard does both for you. It ships a bundled `stimulus-loading.js` that resolves controllers from the importmap at runtime, plus a generator that scaffolds a controller file and keeps the importmap configuration up to date.

## Installation

Add the shard to your `shard.yml`:

```yaml
dependencies:
  marten_stimulus:
    github: treagod/marten-stimulus
```

`marten-importmap` comes in as a transitive dependency. You do not need to declare it separately.

Run `shards install`, then add the requires:

```crystal
# src/project.cr
require "marten_stimulus"
```

```crystal
# src/cli.cr
require "marten/cli"
require "marten_stimulus/cli"  # also loads marten_importmap/cli
```

Both apps must be registered explicitly, in this order:

```crystal
config.installed_apps = [
  MartenImportmap::App,
  MartenStimulus::App,
]
```

## Getting started

If importmap is not initialized yet, run:

```bash
marten importmap init
```

This creates `config/initializers/importmap.cr`, `config/initializers/importmap_pins.cr`, and `src/assets/application.js`. See [marten-importmap](https://github.com/treagod/marten-importmap) for the details.

> **Note:** `marten importmap init` looks for a literal `require "marten_importmap"`, so a project that only requires `marten_stimulus` gets a redundant require line added. Crystal's `require` is idempotent, so the line does no harm. You can delete it.

Pin Stimulus:

```bash
marten importmap pin @hotwired/stimulus
```

Boot it in `src/assets/application.js` and let the loader pick up your controllers:

```javascript
import { Application } from "@hotwired/stimulus"
import { eagerLoadControllersFrom } from "stimulus-loading"

const Stimulus = Application.start()
eagerLoadControllersFrom("controllers", Stimulus)
```

Finally, add `pin_all_from` to `config/initializers/importmap.cr` so the controllers directory ends up in the importmap:

```crystal
Marten.configure do |config|
  config.importmap.draw do
    pin "application", "application.js"
    pin_all_from(
      "src/assets/controllers",
      under: "controllers"
    )
  end
end
```

You do not have to pin `stimulus-loading` yourself. `MartenStimulus::App` pins it during setup, and Marten's asset pipeline serves it from the shard's bundled assets.

## Generating controllers

```bash
marten stimulus generate controller hello
```

The command creates `src/assets/controllers/hello_controller.js`:

```javascript
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    console.log("HelloController connected", this.element)
  }
}
```

It also checks that `pin_all_from "src/assets/controllers", under: "controllers"` is present in `config/initializers/importmap.cr` and inserts it into the `draw` block if it is missing.

The generator validates before it writes anything:

- Names that resolve outside `src/assets/controllers` are rejected.
- A missing `config/initializers/importmap.cr` aborts the command with a hint to run `marten importmap init`.
- An existing controller file is skipped instead of overwritten.

### Naming

Identifiers follow the Stimulus conventions. The `_controller` suffix is dropped. Underscores become dashes and directories become double dashes.

| File | Identifier | Usage |
| --- | --- | --- |
| `controllers/hello_controller.js` | `hello` | `data-controller="hello"` |
| `controllers/my_form_controller.js` | `my-form` | `data-controller="my-form"` |
| `controllers/admin/user_controller.js` | `admin--user` | `data-controller="admin--user"` |

Only files ending in `_controller.js` are treated as controllers. Shared helpers can live under `src/assets/controllers/` too. They still land in the importmap and remain importable, but the loader will not register them.

## Loading strategies

### Eager loading

`eagerLoadControllersFrom(under, application)` imports and registers every matching controller on page load:

```javascript
import { eagerLoadControllersFrom } from "stimulus-loading"
eagerLoadControllersFrom("controllers", Stimulus)
```

Keep the default `preload: true` on `pin_all_from` here, since the controllers are needed immediately anyway.

The function returns a promise. A failed import rejects it with the controller identifier and the module path in the error message, so attach a `.catch()` if you want to report those failures.

### Lazy loading

`lazyLoadControllersFrom(under, application, element = document)` waits until an identifier actually shows up in a `data-controller` attribute before importing and registering it:

```javascript
import { lazyLoadControllersFrom } from "stimulus-loading"
lazyLoadControllersFrom("controllers", Stimulus)
```

To defer the downloads as well, turn off preloading for the controller pins:

```crystal
pin_all_from(
  "src/assets/controllers",
  under: "controllers",
  preload: false
)
```

Without `preload: false`, execution and registration are still lazy, but the browser may already have downloaded every controller through module preload links.

Failed imports are logged to the console with the identifier and the module path. They do not interrupt the rest of the page.

The optional third argument narrows the initial scan to a subtree:

```javascript
lazyLoadControllersFrom("controllers", Stimulus, element)
```

The mutation observer still watches the whole document afterwards, so controllers added to the page later are picked up regardless of the scan root.

## How it works

`MartenStimulus::App` pins `stimulus-loading` during app setup. It points at a `stimulus-loading.js` file bundled in the shard's `assets/` directory, which Marten's asset pipeline discovers on its own.

Both loaders read the importmap JSON from the page at runtime. Eager loading walks the importmap and imports every entry below the given prefix that looks like a controller. Lazy loading resolves identifiers found in `data-controller` attributes back to module paths. In both cases the module's default export is registered with Stimulus.

## Credits

`stimulus-loading.js` is adapted from [hotwired/stimulus-rails](https://github.com/hotwired/stimulus-rails), MIT licensed.

## License

MIT. See [LICENSE](LICENSE).
