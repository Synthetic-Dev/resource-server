// Get environment variables
require("dotenv").config()

const Crypto = require("crypto")
const Stream = require("stream")
const AdmZip = require("adm-zip")
const NodeCache = require("node-cache")
const Express = require("express")
const Timeout = require("connect-timeout")

const RequestLogger = require("./utils/requestLogger")
const { response } = require("express")

/**
 * Startup
 */
const app = Express()
console.log("App created")

app.use(Timeout(10 * 1000))
app.use(RequestLogger)

function download(response, fileName) {
    response.download(__dirname + `/resources/${fileName}.zip`, `${fileName}.zip`)
}

const RESOURCES = ["Netherite Shield", "Backpacks"]
const RESOURCES_MAP = {}

for (let resource of RESOURCES) {
    RESOURCES_MAP[resource.toLowerCase().replace(/\s+/g, "-")] = resource
}

app.get("/spigot-resource/:resource", (request, response, next) => {
    let resource = request.params.resource;

    let fileName = RESOURCES_MAP[resource];
    if (!fileName) {
        return response.sendStatus(404)
    }

    download(response, fileName)
})

const sha1Cache = new NodeCache({
    stdTTL: 60 * 30
})
const combinationBufferCache = new NodeCache({
    stdTTL: 60 * 30,
    useClones: false
})

function getSha1(identifier, buffer) {
    let sha1 = sha1Cache.get(identifier)
    if (sha1) return sha1

    let hash = Crypto.createHash("sha1")
    hash.update(buffer)
    sha1 = hash.digest("base64")
    sha1Cache.set(identifier, sha1)
    return sha1
}

app.get("/spigot-resource-combine", (request, response, next) => {
    let resources = request.query.resources
    if (!resources) {
        return response.sendStatus(400)
    }

    let wantsSha1 = !!request.query.sha1

    resources = resources.trim().split(",")
    let fileNames = []
    for (let resource of resources) {
        let fileName = RESOURCES_MAP[resource]
        if (!fileName) {
            return response.sendStatus(400)
        }
        fileNames.push(fileName)
    }

    if (fileNames.length < 1) {
        return response.sendStatus(400)
    }

    if (fileNames.length == 1) {
        let fileName = fileNames[0]
        if (wantsSha1) {
            let zip = new AdmZip(`./resources/${fileName}.zip`)
            let sha1 = getSha1(fileName, zip.toBuffer())
            response.send(sha1)
        } else {
            download(response, fileName)
        }
        return
    }

    fileNames = fileNames.sort()
    let combinedName = fileNames.join("+")

    let readStream = new Stream.PassThrough()

    let buffer = combinationBufferCache.get(combinedName)
    if (!buffer) {
        let zip = new AdmZip(`./resources/${fileNames[0]}.zip`)

        for (let i = 1; i < fileNames.length; i++) {
            let fileName = fileNames[i]
            let otherZip = new AdmZip(`./resources/${fileName}.zip`)
            for (let entry of otherZip.getEntries()) {
                let mainEntry = zip.getEntry(entry.entryName)
                if (mainEntry) {
                    if (entry.isDirectory) continue;
                } else {
                    if (entry.isDirectory) {
                        zip.addFile(entry.entryName)
                    } else {
                        zip.addFile(entry.entryName, entry.getData(), entry.comment, entry.attr)
                    }
                }
            }
        }

        let mcmeta = JSON.parse(zip.readAsText("pack.mcmeta"))
        mcmeta.pack.description = combinedName
        zip.updateFile("pack.mcmeta", Buffer.from(JSON.stringify(mcmeta)))

        buffer = zip.toBuffer()
        combinationBufferCache.set(combinedName, buffer)
    }

    if (wantsSha1) {
        let sha1 = getSha1(combinedName, buffer)
        response.send(sha1)
    } else {
        response.set('Content-disposition', 'attachment; filename=' + combinedName + ".zip")
        readStream.end(buffer)
        readStream.pipe(response)
    }
})

/**
 * Listeners
 */
app.listen(process.env.PORT, () => {
    console.log("Listening on port " + process.env.PORT.toString())
})