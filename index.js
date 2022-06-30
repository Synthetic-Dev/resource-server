// Get environment variables
require("dotenv").config()

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

app.get("/spigot-resource/:resource", (request, response, next) => {
    let resource = request.params.resource;
    let fileSent = false

    switch (resource) {
        case "netherite-shield":
            download(response, "Netherite Shield")
            fileSent = true
            break
        case "backpacks":
            download(response, "Backpacks")
            fileSent = true
    }

    if (!fileSent) {
        response.sendStatus(404)
    }
})

/**
 * Listeners
 */
app.listen(process.env.PORT, () => {
    console.log("Listening on port " + process.env.PORT.toString())
})