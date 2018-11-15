const {
    MoleculerError
} = require("moleculer").Errors;
const has = require("lodash/has");

module.exports = {
	name: "@authentification",
	settings: {
		key: "moleculer-is-great",
	},
	actions: {
		"#verify/exists"(ctx) {
			if (!has(ctx.params, "event.headers")) {
				throw new MoleculerError("@authentification", 403, "NO_HEADERS", { message: "No headers on your request" });
			}
			const headers = ctx.params.event.headers;
			if (!has(headers, "x-api-key")) {
				throw new MoleculerError("@authentification", 403, "AUTH_NOT_AUTHORISE", { message: "Sorry, you don't have a key" });
			}
			if (headers["x-api-key"] != this.settings.key) {
				throw new MoleculerError("@authentification", 403, "AUTH_NOT_AUTHORISE", { message: "Sorry, your're not authorise" });
			}
			console.log("@authentification.#verify/exists - it's ok");
		}
	}
}
