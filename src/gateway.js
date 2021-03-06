/*
 * moleculer-@lambda
 */

 "use strict";
const { MoleculerError } = require("moleculer").Errors;
const Promise = require("bluebird");

/*
        Gateway
*/
module.exports = {
    name: "@lambda",
    /**
     * Service created lifecycle event handler
     */
    created() {
        // this.logger.info("LambdaGateway created")
    },
    /**
     * Service started lifecycle event handler
     */
    started() {
        this.logger.info("LambdaGateway Started", this.schema);
        // Object.keys(this.schema.)
    },
    /**
     * Service stopped lifecycle event handler
     */
    stopped() {
        // this.logger.info("LambdaGateway Stopped")
    },
    actions: {
        "action"(ctx) {
            //  prevent missing action
            this.logger.info("@lambda - require action ", ctx.params.action);
            if (!this["has-action"](ctx.params.action)) {
                throw new MoleculerError("Action not found", 404, "ACTION_NOT_FOUND", { action: ctx.params.action });
            }
            if (ctx.params.bodyParsed) {
                ctx.params.event = this["parse-body"](ctx.params.event);
                this.logger.info("@lambda - body parsed", ctx.params.event);
            }
            //  Verify anykind of warm
            if (this["serverless-plugin-warmup"](ctx.params.event) || this["custom-warm-body"](ctx.params.event)) {
                // this["response-warm"](ctx.params.callback);
                // console.clear();
                return this["get-response"](200, null, { message: "Lambda warmed" })
            } else {
                this.logger.info("@lambda - params", ctx.params);
                return Promise.resolve()
                    //  Middlewares
                    .then(() => {
                        this.logger.info("Verify middlewares");
                        return Promise.resolve(ctx.params.middlewares)
                            .mapSeries((m) => ctx.call(m, ctx.params))
                    })
                    //
                    .then(() => ctx.call(`@lambda.${ctx.params.action}`, ctx.params))
                    .then((response) => ctx.call("@lambda.lambda-success", { response: response }))
                    .catch((error) => ctx.call("@lambda.lambda-fail", { error: error }));
            }
        },
        "lambda-success"(ctx) {
            this.logger.info("lambda-success - ", ctx.params.response);
            let body = undefined;
            let code = 200;
            let headers = {};

            if (ctx.params.response && !ctx.params.response.hasOwnProperty("body")) {
                body = ctx.params.response;
                code = 200;
            } else {
                body = ctx.params.response.body;
                code = ctx.params.response.code;
                headers = ctx.params.response.headers || {};
            }

            return this["get-response"](
                code,
                headers,
                body
            );

        },
        "lambda-fail"(ctx) {
            this.logger.info("lambda-fail - ", ctx.params.error);
            return this["get-response"](
                ctx.params.error.code || 500,
                null,
                {
                    type: ctx.params.error.type || "Critical",
                    data: ctx.params.error.data || ctx.params.error.toString()
                }
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
                body: JSON.stringify(body)
            };
        }
    }
}
