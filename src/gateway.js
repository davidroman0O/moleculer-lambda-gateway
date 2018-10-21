/*
 * moleculer-lambda-gateway
 */

 "use strict";
const { MoleculerError } = require("moleculer").Errors;

/*
		Gateway
*/
module.exports = {
    name: "lambda-gateway",
    /**
     * Service created lifecycle event handler
     */
    created() {
        this.logger.info("LambdaGateway created")
    },
    /**
     * Service started lifecycle event handler
     */
    started() {
        this.logger.info("LambdaGateway Started", this.actions);
    },
    /**
     * Service stopped lifecycle event handler
     */
    stopped() {
        this.logger.info("LambdaGateway Stopped")
    },
    actions: {
        handle(ctx) {
            //  prevent missing action
            if (!this["has-action"](ctx.params.action)) {
                throw new MoleculerError("Action not found", 404, "ACTION_NOT_FOUND", { action: ctx.params.action });
            }
            //  Verify anykind of warm
            if (this["serverless-plugin-warmup"](ctx.params.event) || this["custom-warm-body"](ctx.params.event)) {
                this["response-warm"](ctx.params.callback);
            } else {
                return Promise.resolve()
                    .then(() => ctx.call(`lambda-gateway.${ctx.params.action}`, ctx.params))
                    .then((response) => ctx.call("lambda-gateway.lambda-success", { callback: ctx.params.callback, response: response }))
                    .catch((error) => ctx.call("lambda-gateway.lambda-fail", { callback: ctx.params.callback, error: error }));
            }
        },
        "lambda-success"(ctx) {
            this.logger.info("lambda-success - ", ctx.params.response);
            let body = undefined;
            let code = 200;
            let headers = {};

            if (!ctx.params.response.hasOwnProperty("body")) {
                body = ctx.params.response;
                code = 200;
            } else {
                body = ctx.params.response.body;
                code = ctx.params.response.code;
                headers = ctx.params.response.headers || {};
            }

            this["response-success"](ctx.params.callback, 
                code,
                headers,
                body,
            );

        },
        "lambda-fail"(ctx) {
            this.logger.info("lambda-fail - ", ctx.params.error);
            this["response-fail"](ctx.params.callback, 
                ctx.params.error.code || 500,
                {},
                {
                    type: ctx.params.error.type || "Critical",
                    data: ctx.params.error.data || ctx.params.error.toString()
                },
            );
        }
    },
    methods: {
        "has-action"(action) {
            return this.actions.hasOwnProperty(action); 
        },
        "serverless-plugin-warmup"(event) {
            if (event.source === 'serverless-plugin-warmup') {
                this.logger.info("serverless-plugin-warmup - detected - warm");
                return true;
            }
            return false;
        },
        "parse-body"(event) {
            let clone = Object.assign({}, event);
            if (typeof clone.body == "string") {
                clone.body = JSON.parse(clone.body);
            }
            return clone;
        },
        "custom-warm-body"(event) {
            let e = this["parse-body"](event);
            if (e.body && e.body.warm) {
                return e.body.warm;
            }
            return false;
        },
        "get-response"(code, headers, body) {
            let localHeaders = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
            };
            if (headers) {
                Object.keys(headers).forEach((k) => {
                    localHeaders[k] = headers[k];
                });
            }
            return {
                headers: localHeaders,
                statusCode: code,
                body: body
            };
        },
        "response-success"(callback, code, headers, body) {
            this.logger.info("lambda-gateway - response-success - ", code, headers, body);
            callback(null, this["get-response"](code, headers, body));
        },
        "response-fail"(callback, code, headers, body) {
            this.logger.info("lambda-gateway - response-fail - ", code, headers, body);
            callback(null, this["get-response"](code, headers, body));
        },
        "response-warm"(callback) {
            this.logger.info("lambda-gateway - response-warm - ");
            callback(null, this["get-response"](200, null, { message: "Lambda warmed" }));
        }
    }
}