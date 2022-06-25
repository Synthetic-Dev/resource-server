String.prototype.trimStart = function (charlist) {
    if (charlist === undefined) charlist = "\s";
    return this.replace(new RegExp("^[" + charlist + "]+"), "");
}

String.prototype.trimEnd = function (charlist) {
    if (charlist === undefined) charlist = "\s";
    return this.replace(new RegExp("[" + charlist + "]+$"), "");
}

function isInt(n) {
    return n % 1 === 0
}

function lowercaseKeys(query) {
    return Object.keys(query).reduce((newQuery, key) => {
        newQuery[key.toLowerCase()] = query[key]
        return newQuery
    }, {})
}

module.exports = {
    isInt: isInt,
    lowercaseKeys: lowercaseKeys
}