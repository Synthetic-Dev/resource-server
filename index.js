// Get environment variables
require("dotenv").config()

const fs = require("fs")
const Path = require("path")
const Http = require("http")
const Https = require("https")
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

app.get("/spigot-resource/:resource", (request, response, next) => {
    let resource = request.params.resource;
    let fileSent = false

    switch (resource) {
        case "netherite-shield":
            response.download(__dirname + "/resources/Netherite Shield.zip", "Netherite Shield.zip")
            fileSent = true
            break
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