// Get environment variables
require("dotenv").config()

const FileSystem = require("fs")
const Crypto = require("crypto")
const Stream = require("stream")
const AdmZip = require("adm-zip")
const NodeCache = require("node-cache")
const Express = require("express")
const Timeout = require("connect-timeout")

const RequestLogger = require("./utils/requestLogger")

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

const GENERATED_FILES = "./generated"
FileSystem.readdir(GENERATED_FILES, (err, files) => {
    if (err) throw err;

    for (const file of files) {
        if (file == ".gitignore") continue
        FileSystem.unlink(GENERATED_FILES + "/" + file, err => {
            if (err) throw err;
        });
    }
});

const SHA1_TO_RESOURCE_MAP = {}
const sha1Cache = new NodeCache({
    stdTTL: 60 * 30
})
const bufferCache = new NodeCache({
    stdTTL: 60 * 30,
    useClones: false
})

function getSha1(identifier, buffer) {
    let sha1 = sha1Cache.get(identifier)
    if (sha1) return sha1

    let hash = Crypto.createHash("sha1")
    hash.update(buffer)
    sha1 = hash.digest("hex")
    sha1Cache.set(identifier, sha1)
    return sha1
}

app.get("/spigot-resources/direct/:resource", (request, response, next) => {
    let resource = request.params.resource

    let fileName = RESOURCES_MAP[resource]
    if (!fileName) {
        return response.sendStatus(404)
    }

    download(response, fileName)
})

app.get("/spigot-resources/get/:sha1", (request, response, next) => {
    let sha1 = request.params.sha1;

    let identifier = SHA1_TO_RESOURCE_MAP[sha1];
    if (!identifier) {
        return response.sendStatus(404)
    }

    let buffer = bufferCache.get(identifier);
    if (!buffer) {
        return response.status(400).send("sha1 cooldown exceeded, /spigot-resources/sha1 must be called before this endpoint")
    }

    let readStream = new Stream.PassThrough()
    response.set('Content-disposition', 'attachment; filename=' + identifier + ".zip")
    readStream.end(buffer)
    readStream.pipe(response)
})

app.get("/spigot-resources/sha1", (request, response, next) => {
    let resources = request.query.resources
    if (!resources) {
        return response.status(400).send("Missing resources")
    }

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
        let buffer = bufferCache.get(fileName)
        if (!buffer) {
            let zip = new AdmZip(`./resources/${fileName}.zip`)
            buffer = zip.toBuffer()
            bufferCache.set(fileName, buffer)
        }

        let sha1 = getSha1(fileName, buffer)
        SHA1_TO_RESOURCE_MAP[sha1] = fileName
        response.send(sha1)
        return
    }

    fileNames = fileNames.sort()
    let combinedName = fileNames.join("+")

    let buffer = bufferCache.get(combinedName)
    if (!buffer) {
        let generatedFilePath = `${GENERATED_FILES}/${combinedName}.zip`
        if (!FileSystem.existsSync(generatedFilePath)) {
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

            zip.writeZip(generatedFilePath)
        }

        let zip = new AdmZip(generatedFilePath)
        buffer = zip.toBuffer()
        bufferCache.set(combinedName, buffer)
    }

    let sha1 = getSha1(combinedName, buffer)
    SHA1_TO_RESOURCE_MAP[sha1] = combinedName
    response.send(sha1)
})

/**
 * Listeners
 */
app.listen(process.env.PORT, () => {
    console.log("Listening on port " + process.env.PORT.toString())
})