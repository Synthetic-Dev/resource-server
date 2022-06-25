module.exports = (request, resolve, next) => {
    let date = new Date()
    console.log(`<${date.toISOString()}> request method=${request.method} host=${request.hostname} path=${request.path} ip=${request.ip} protocol=${request.protocol} secure=${request.secure} bytes=${request.socket.bytesRead}`)
    next()
}