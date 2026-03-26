# MartenStimulus

[Hotwire Stimulus](https://stimulus.hotwired.dev) integration for [Marten](https://martenframework.com), built on top of [marten-importmap](https://github.com/treagod/marten-importmap).

Provides:

- Bundled `stimulus-loading.js` asset, auto-pinned into the importmap
- `marten stimulus generate controller <name>` CLI command to scaffold controllers

## Installation

Add both shards to your `shard.yml`:

```yaml
dependencies:
  marten_importmap:
    github: treagod/marten-importmap
  marten_stimulus:
    github: treagod/marten-stimulus
```

Run `shards install`, then add the requires:

```crystal
# src/project.cr
require "marten_importmap"
require "marten_stimulus"
```

```crystal
# src/cli.cr
require "marten/cli"
require "marten_stimulus/cli"
```

Add both apps to `config.installed_apps`:

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
    pin_all_from "src/assets/controllers", under: "controllers"
  end
end
```

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

**`eagerLoadControllersFrom(under, application)`** — imports all matching controllers immediately on page load:

```javascript
import { eagerLoadControllersFrom } from "stimulus-loading"
eagerLoadControllersFrom("controllers", Stimulus)
```

**`lazyLoadControllersFrom(under, application)`** — imports a controller only when an element with the matching `data-controller` attribute first appears in the DOM:

```javascript
import { lazyLoadControllersFrom } from "stimulus-loading"
lazyLoadControllersFrom("controllers", Stimulus)
```

Lazy loading uses a `MutationObserver` to watch for new elements, which can reduce the initial JavaScript footprint on pages that don't use every controller.

## How it works

`MartenStimulus::App` pins `stimulus-loading` during app setup, pointing to a `stimulus-loading.js` asset bundled inside the shard. Marten's asset pipeline discovers it automatically via the app's `assets/` directory.

Both loading functions read the importmap JSON at runtime, find all entries whose key starts with the given prefix (`controllers/`), and register each module's default export with Stimulus. Controller identifiers are derived by stripping the `_controller` suffix and converting underscores to dashes (e.g. `controllers/my_form_controller` → `my-form`).
