import { createServer } from "node:http"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
)
const port = Number(process.env.PORT || 4173)

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
}

function filePathFor(requestUrl) {
  const pathname = decodeURIComponent(requestUrl)
  const relativePath = pathname === "/"
    ? "test/browser/fixtures/index.html"
    : pathname.slice(1)
  const filePath = path.resolve(repositoryRoot, relativePath)

  if (filePath !== repositoryRoot && !filePath.startsWith(`${repositoryRoot}${path.sep}`)) {
    return null
  }

  return filePath
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" })
    response.end()
    return
  }

  let filePath
  try {
    filePath = filePathFor(new URL(request.url || "/", "http://127.0.0.1").pathname)
  } catch {
    response.writeHead(400)
    response.end("Bad request")
    return
  }

  if (!filePath) {
    response.writeHead(403)
    response.end("Forbidden")
    return
  }

  try {
    const fileStats = await stat(filePath)
    if (!fileStats.isFile()) throw new Error("Not a file")

    const body = await readFile(filePath)
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Content-Length": body.length,
    })
    if (request.method === "GET") response.end(body)
    else response.end()
  } catch {
    response.writeHead(404)
    response.end("Not found")
  }
})

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving ${repositoryRoot} at http://127.0.0.1:${port}`)
})

process.on("SIGTERM", () => server.close())
process.on("SIGINT", () => server.close())
