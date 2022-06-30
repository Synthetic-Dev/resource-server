// Get environment variables
require("dotenv").config()

const Stream = require("stream")
const AdmZip = require("adm-zip")
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

app.get("/spigot-resource-combine", (request, response, next) => {
    let resources = request.query.resources
    if (!resources) {
        return response.sendStatus(400)
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

    if (fileNames.length < 2) {
        return response.sendStatus(400)
    }

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

    let combinedName = fileNames.join("+")

    let mcmeta = JSON.parse(zip.readAsText("pack.mcmeta"))
    mcmeta.pack.description = combinedName
    zip.updateFile("pack.mcmeta", Buffer.from(JSON.stringify(mcmeta)))

    let readStream = new Stream.PassThrough()
    readStream.end(zip.toBuffer())

    response.set('Content-disposition', 'attachment; filename=' + combinedName + ".zip")
    readStream.pipe(response)
})

/**
 * Listeners
 */
app.listen(process.env.PORT, () => {
    console.log("Listening on port " + process.env.PORT.toString())
})