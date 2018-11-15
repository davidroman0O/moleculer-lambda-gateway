const {
    ServiceBroker
} = require("moleculer");
const {
    MoleculerError
} = require("moleculer").Errors;
// const util = require("util");

const Promise = require("bluebird");
const has = require("lodash/has");

// TODO: create better way to handle logging
const CreateMoleculer = (service) => {

    let brokerOptions = {};

    if (has(service, "settings.moleculer")) {
        brokerOptions = service.settings.moleculer;
    }

    if (!has(service, "name")) {
        service.name = "@gateway";
    }

    if (!has(service, "lambdas")) {
        throw new Error("No lambdas field");
    }

    if (has(service, "actions")) {
        throw new Error("Please, do not use 'actions' field on this service");
    }

    //	Yep, I want YOU to not use actions
    //	Actions are remapped during the mixins, I don't want complications
    service.actions = service.lambdas;

    // 1 - Create Service
    const broker = new ServiceBroker(brokerOptions);

    if (!has(service, `actions.${process.env.AWS_LAMBDA_FUNCTION_NAME}`)) {
        throw new Error(`actions.${process.env.AWS_LAMBDA_FUNCTION_NAME} doesn't exists`);
    }

    // Oh ? You got some services? Let's load them!
    if (has(service, `actions.${process.env.AWS_LAMBDA_FUNCTION_NAME}.services`)) {
        service.actions[process.env.AWS_LAMBDA_FUNCTION_NAME].services.forEach((s) => {
            console.log(`@serverless - createService ${__dirname+"/"+s}`);
            broker.createService(require(__dirname + "/" + s));
        });
    } else {
        console.log(`@serverless - has no services`);
    }

    const eventService = {
        name: "@event",
        settings: service.settings,
        mixins: [service],
        actions: {
            "#receive": {
                params: {},
                handler(ctx) {
                    console.log("@event.#receive | params ", ctx.params);
                    if (
                        service.actions[process.env.AWS_LAMBDA_FUNCTION_NAME].middlewares &&
                        service.actions[process.env.AWS_LAMBDA_FUNCTION_NAME].middlewares.length > 0
                    ) {
                        console.log("@event.#receive | middlewares")
                        return Promise.resolve(service.actions[process.env.AWS_LAMBDA_FUNCTION_NAME].middlewares)
                            .mapSeries((m) => {
                                console.log("@event.#receive | middleware :", m);
                                // TODO: manage functions
                                // TODO: manage services ?
                                // TODO: manage mooooaaarr
                                return ctx.call(m, ctx.params);
                            })
                            .then(() => ctx.call(`@event.${process.env.AWS_LAMBDA_FUNCTION_NAME}`, ctx.params));
                    }
                    return ctx.call(`@event.${process.env.AWS_LAMBDA_FUNCTION_NAME}`, ctx.params);
                }
            }
        }
    };

    broker.createService(eventService);

    return broker;
};


const Handler = (service) => {
    //
    let statusCode = 200;
    let headers = {};
    let body = undefined;
    //
    return function(event, context, callback) {
        try {
            console.time("Execution");
            const params = {
                // AWS Lambda data
                event: event,
                context: context,
                // AWS Lambda callback
                callback: callback,
            };

            let parse = () => {
                if (has(event, "body")) {
                    if (typeof event.body == "string") {
                        event.body = JSON.parse(event.body);
                    }
                }
            }

            //	Parse body if dev want it
            if (has(service, "settings.gateway.bodyParse")) {
                parse();
            }

            // Managing the middlewares simply
            let middlewareResponse = undefined;
            if (has(service, "settings.middlewares")) {
                service.settings.middlewares.forEach((m) => {
                    if (middlewareResponse == undefined) {
                        middlewareResponse = m(event, context, callback);
                    }
                });
            }


            //	Generic response lambda
            let lambda = (code, headers, body) => {
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

            let success = (response) => {
                console.log("@serverless - success");
                // If you have a body, you have a code
                if (has(response, ["body", "code"])) {
                    if (has(response, "body")) {
                        body = response.body;
                    }
                    if (has(response, "code")) {
                        statusCode = response.code;
                    }
                    // headers are optionals
                    if (has(response, "headers")) {
                        headers = response.headers;
                    }
                } else {
                    code = 200;
                    body = response;
                }
                callback(null, lambda(code, headers, body));
            };

            let fail = (error) => {
                console.log("@serverless - fail", typeof error);
                if (error.type && error.data) {
                    console.log("@serverless - moleculer error");
                    code = error.code || 500;
                    body = {
                        type: error.type,
                        data: error.data.toString()
                    };
                    callback(null, lambda(500, null, body));
                } else {
                    console.log("@serverless - standard error");
                    callback(error);
                }
            };

            if (middlewareResponse) {
                console.log("@serverless - has middleware");
                callback(null, success(middlewareResponse));
                return;
            }

            //	Replacing succes when success
            if (has(service, "settings.success")) {
                success = service.settings.success;
            }

            //	Replacing error when error
            if (has(service, "settings.error")) {
                error = service.settings.error;
            }

            if (typeof middlewareResponse !== undefined) {
                // console.log("call", process.env.AWS_LAMBDA_FUNCTION_NAME);
                const broker = CreateMoleculer(service);
                Promise.resolve()
                    .then(() => broker.start())
                    .then(() => broker.call("@event.#receive", params)
                        .then(r => broker.stop()
                            .then(() => console.timeEnd("Execution"))
                            .then(() => success(r))
                        )
                        .catch((e) => {
                            console.timeEnd("Execution");
                            fail(e);
                        })
                    )
            } else {
            	console.log("@event - we got a middleware lambda response");
                callback(null, middlewareResponse);
            }
        } catch (e) {
        	/*
				If something come here, we're fucked
        	*/
            console.error(e);
            callback(e);
        }
    };
};

module.exports = exports = Handler;
