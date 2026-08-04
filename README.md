# MartenStimulus

[Hotwire Stimulus](https://stimulus.hotwired.dev) integration for [Marten](https://martenframework.com), built on top of [marten-importmap](https://github.com/treagod/marten-importmap).

Provides:

- Bundled `stimulus-loading.js` asset, auto-pinned into the importmap
- `marten stimulus generate controller <name>` CLI command to scaffold controllers

## Installation

Add the shard to your `shard.yml`:

```yaml
dependencies:
  marten_stimulus:
    github: treagod/marten-stimulus
```

`marten-importmap` is pulled in as a transitive dependency — no need to declare it separately.

Run `shards install`, then add the require:

```crystal
# src/project.cr
require "marten_stimulus"
```

```crystal
# src/cli.cr
require "marten/cli"
require "marten_stimulus/cli"  # also loads marten_importmap/cli
```

Both apps must be registered explicitly in `config.installed_apps` in the correct order:

```crystal
config.installed_apps = [
  MartenImportmap::App,
  MartenStimulus::App,
]
```

## Setup

If you haven't initialized importmap yet, run:

```bash
marten importmap init
```

This creates `config/initializers/importmap.cr`, `config/initializers/importmap_pins.cr`, and `src/assets/application.js`. See [marten-importmap](https://github.com/treagod/marten-importmap) for full details.

> **Note:** `marten importmap init` checks for `require "marten_importmap"` literally. If your project only has `require "marten_stimulus"`, it will insert a redundant `require "marten_importmap"` line. This is harmless — Crystal's require is idempotent — but you can remove it afterwards since `marten_stimulus` already pulls it in.

Pin Stimulus:

```bash
marten importmap pin @hotwired/stimulus
```

Then update `src/assets/application.js` to boot Stimulus and load controllers automatically:

```javascript
import { Application } from "@hotwired/stimulus"
import { eagerLoadControllersFrom } from "stimulus-loading"

const Stimulus = Application.start()
eagerLoadControllersFrom("controllers", Stimulus)
```

Add `pin_all_from` to `config/initializers/importmap.cr` so the controllers directory is included in the importmap:

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

This configuration uses the default `preload: true`, which is appropriate when eagerly loading a modest number of controllers.

`stimulus-loading` is pinned automatically by `MartenStimulus::App` and served as `stimulus-loading.js` from the shard's bundled assets — no manual pin or vendor file needed.

## Generating controllers

```bash
marten stimulus generate controller hello
# → creates src/assets/controllers/hello_controller.js
# → ensures pin_all_from is present in config/initializers/importmap.cr
```

The generated file:

```javascript
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    console.log("HelloController connected", this.element)
  }
}
```

Controller naming follows the Stimulus convention: `hello_controller.js` is registered as `hello`, `my_form_controller.js` as `my-form`. Use `data-controller="hello"` in your templates to attach it.

## Loading strategies

Two loading strategies are available:

### Eager loading

`eagerLoadControllersFrom(under, application)` imports and registers all matching controllers immediately on page load:

```javascript
import { eagerLoadControllersFrom } from "stimulus-loading"
eagerLoadControllersFrom("controllers", Stimulus)
```

Configure the controller pins with the default preload behavior:

```crystal
pin_all_from(
  "src/assets/controllers",
  under: "controllers"
)
```

The default `preload: true` is suitable for a modest number of eagerly loaded controllers.

### Lazy loading

`lazyLoadControllersFrom(under, application, element = document)` delays importing and registering a controller until its identifier appears in a `data-controller` attribute:

```javascript
import { lazyLoadControllersFrom } from "stimulus-loading"
lazyLoadControllersFrom("controllers", Stimulus)
```

To defer controller downloads as well, disable preloading for the controller pins:

```crystal
pin_all_from(
  "src/assets/controllers",
  under: "controllers",
  preload: false
)
```

Without `preload: false`, controller execution and registration remain lazy, but the browser may still download the controllers through module preload links.

Pass an element as the optional third argument to limit the initial controller scan to that root:

```javascript
lazyLoadControllersFrom("controllers", Stimulus, element)
```

The current mutation observer continues to watch the entire document for later controller changes.

Failed controller imports are reported in the browser console with the controller identifier and importmap module path.

## How it works

`MartenStimulus::App` pins `stimulus-loading` during app setup, pointing to a `stimulus-loading.js` asset bundled inside the shard. Marten's asset pipeline discovers it automatically via the app's `assets/` directory.

Both loading functions read the importmap JSON at runtime. Eager loading imports valid controller entries below the given prefix (`controllers/`), while lazy loading resolves controllers referenced by `data-controller` attributes in the DOM. Each module's default export is registered with Stimulus. Controller identifiers are derived by stripping the `_controller` suffix and converting underscores to dashes (e.g. `controllers/my_form_controller` → `my-form`).
