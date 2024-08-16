import fsSync from "fs"
import fs from "fs/promises"
import Seven, { SevenZipOptions } from "node-7z"
import path from "path"
import which from "which"
import yauzl from "yauzl"

const downloadPath = "download"
const extractedPath = "extracted"
const publicDocsPath = "../public/docs"

async function writeRedirectFile(
  destPath: string,
  latestBugfixVersion: string,
  relativePath: string,
) {
  await fs.writeFile(
    destPath,
    `<html><head><meta http-equiv="refresh" content="0;URL='/docs/${latestBugfixVersion}/${relativePath}'"/></head></html>`,
  )
}

async function extractEntry(
  zipfile: yauzl.ZipFile,
  entry: yauzl.Entry,
  extractedVersionPath: string,
  publicDocsVersionPath: string,
  apidocsOnly: boolean,
  latestBugfixVersion: string | undefined,
) {
  if (entry.fileName.endsWith("/")) {
    // skip directories
    return
  }

  if (
    entry.fileName.startsWith("scaladocs/") ||
    entry.fileName.startsWith("yardoc/") ||
    entry.fileName.startsWith("kdoc/") ||
    entry.fileName.startsWith("jsdoc/")
  ) {
    // skip unnecessary files
    return
  }

  // skip non-html apidoc files if we are supposed to redirect to a latest bugfix version
  if (
    latestBugfixVersion !== undefined &&
    entry.fileName.startsWith("apidocs/") &&
    !entry.fileName.endsWith(".html")
  ) {
    return
  }

  // only include index.adoc files if there is a latest bugfix version
  if (
    latestBugfixVersion !== undefined &&
    !entry.fileName.startsWith("apidocs/") &&
    !entry.fileName.endsWith("index.adoc")
  ) {
    return
  }

  // skip everything but apidocs
  if (apidocsOnly && !entry.fileName.startsWith("apidocs/")) {
    return
  }

  let destPath
  if (
    latestBugfixVersion !== undefined ||
    entry.fileName.startsWith("apidocs/")
  ) {
    destPath = path.join(publicDocsVersionPath, entry.fileName)
  } else {
    destPath = path.join(extractedVersionPath, entry.fileName)
  }

  // rename index.adoc to index.html
  if (
    latestBugfixVersion !== undefined &&
    !entry.fileName.startsWith("apidocs/")
  ) {
    destPath = destPath.replace(/\.adoc$/, ".html")
  }

  try {
    let stat = await fs.stat(destPath)
    if (
      stat.size === entry.uncompressedSize &&
      +entry.getLastModDate() === stat.mtimeMs
    ) {
      return
    }
  } catch (e) {
    // file does not exist
  }

  await fs.mkdir(path.dirname(destPath), { recursive: true })

  if (latestBugfixVersion === undefined) {
    let writeStream = fsSync.createWriteStream(destPath)
    await new Promise<void>((resolve, reject) => {
      zipfile.openReadStream(entry, (err, readStream) => {
        if (err) {
          reject(err)
          return
        }

        readStream.on("end", function () {
          writeStream.close(_ => {
            resolve()
          })
        })

        readStream.on("error", reject)
        readStream.pipe(writeStream)
      })
    })
  } else {
    // create an HTML file that redirects to the latest bugfix version
    if (entry.fileName.startsWith("apidocs/")) {
      await writeRedirectFile(destPath, latestBugfixVersion, entry.fileName)
    } else {
      await writeRedirectFile(
        destPath,
        latestBugfixVersion,
        path.dirname(entry.fileName),
      )
    }
  }

  await fs.utimes(destPath, entry.getLastModDate(), entry.getLastModDate())
}

async function extract(
  version: string,
  artifactVersion: string,
  progressListener: ProgressListener | undefined,
  apidocsOnly: boolean,
  latestBugfixVersion: string | undefined,
) {
  let extractedVersionPath = path.join(extractedPath, version)
  let publicDocsVersionPath = path.join(publicDocsPath, version)

  await fs.mkdir(extractedVersionPath, { recursive: true })
  await fs.mkdir(publicDocsVersionPath, { recursive: true })

  let sevenExists = false
  if (apidocsOnly) {
    try {
      await which("7z")
      sevenExists = true
    } catch (e) {
      sevenExists = false
    }
  }

  if (apidocsOnly && sevenExists) {
    await extract7zApidocsOnly(
      version,
      artifactVersion,
      progressListener,
      latestBugfixVersion,
      publicDocsVersionPath,
    )
  } else {
    await extractInternal(
      version,
      artifactVersion,
      progressListener,
      apidocsOnly,
      latestBugfixVersion,
      extractedVersionPath,
      publicDocsVersionPath,
    )
  }
}

async function extractInternal(
  version: string,
  artifactVersion: string,
  progressListener: ProgressListener | undefined,
  apidocsOnly: boolean,
  latestBugfixVersion: string | undefined,
  extractedVersionPath: string,
  publicDocsVersionPath: string,
) {
  await new Promise<void>((resolve, reject) => {
    let zipFilePath = path.join(
      downloadPath,
      `vertx-stack-docs-${artifactVersion}-docs.zip`,
    )
    yauzl.open(zipFilePath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err)
        return
      }

      let entriesRead = 0
      progressListener?.start(zipfile.entryCount, `Extract ${version}`)

      zipfile.on("error", reject)
      zipfile.on("end", () => resolve())

      zipfile.on("entry", entry => {
        extractEntry(
          zipfile,
          entry,
          extractedVersionPath,
          publicDocsVersionPath,
          apidocsOnly,
          latestBugfixVersion,
        )
          .then(() => {
            entriesRead++
            progressListener?.update(entriesRead)
            zipfile.readEntry()
          })
          .catch(reject)
      })

      zipfile.readEntry()
    })
  })
}

async function extract7zApidocsOnly(
  version: string,
  artifactVersion: string,
  progressListener: ProgressListener | undefined,
  latestBugfixVersion: string | undefined,
  publicDocsVersionPath: string,
) {
  let zipFilePath = path.join(
    downloadPath,
    `vertx-stack-docs-${artifactVersion}-docs.zip`,
  )
  if (latestBugfixVersion === undefined) {
    await new Promise<void>((resolve, reject) => {
      let progressStarted = false
      const e = Seven.extractFull(zipFilePath, publicDocsVersionPath, {
        $progress: true,
        overwrite: "s",
        // exclude: ["!kdoc", "!scaladocs", "!yardoc", "!jsdoc"]
        include: ["!apidocs"],
      } as SevenZipOptions & { overwrite: "a" | "s" | "t" | "u" | undefined })
      e.on("progress", progress => {
        if (!progressStarted) {
          progressListener?.start(100, `Extract ${version} (7z)`)
          progressStarted = true
        }
        progressListener?.update(progress.percent)
      })
      e.on("end", () => {
        resolve()
      })
      e.on("error", err => {
        reject(err)
      })
    })
  } else {
    // replace HTML files with files that redirect to latest bugfix version
    // skip everything else
    let files = await new Promise<Seven.Data[]>((resolve, reject) => {
      let f: Seven.Data[] = []
      const e = Seven.list(zipFilePath, {
        include: ["!apidocs"],
      })
      e.on("data", data => {
        if (data.file !== undefined && data.file.endsWith(".html")) {
          f.push(data)
        }
      })
      e.on("end", () => {
        resolve(f)
      })
      e.on("error", err => {
        reject(err)
      })
    })

    progressListener?.start(files.length, `Extract ${version} (7z)`)
    for (let i = 0; i < files.length; ++i) {
      let f: any = files[i]
      let destPath = path.join(publicDocsVersionPath, f.file)

      let exists = false
      try {
        let stat = await fs.stat(destPath)
        if (+f.datetime === stat.mtimeMs) {
          exists = true
        }
      } catch (e) {
        // file does not exist
      }

      if (!exists) {
        await fs.mkdir(path.dirname(destPath), { recursive: true })
        await writeRedirectFile(destPath, latestBugfixVersion, f.file)
        await fs.utimes(destPath, f.datetime, f.datetime)
      }
      progressListener?.update(i)
    }
  }
}

export default extract
