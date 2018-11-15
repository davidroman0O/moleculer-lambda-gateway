const processfake = require("../fixtures/process_fake_00");

const {
    MoleculerError
} = require("moleculer").Errors;

module.exports = {
    settings: {
        gateway: {
            bodyParse: true,
        },
        moleculer: {
            internalMiddlewares: false,
            internalServices: false
        },
        //	Allow you to customize the responses
        // success: (response) => {
        //     // when no error is thrown
        // },
        // error: (error) => {
        //     //	when you throw an error
        // },
        //	Middlewares for lambda
        middlewares: [
            (event, context) => {
            	console.log("@gateway - event middlewares", event.source);
                if (event.source === 'serverless-plugin-warmup') {
                    return {
                    	code: 200,
                    	body: "warmed"
                    }
                }
                return undefined;
            }
        ]
    },
    /*
    	Note: this is how we create a gateway
    	take a look to mixin example
    */
    lambdas: {
        [processfake.env.lambda_math_add_name]: {
            params: {
                event: {
                    type: "object",
                    props: {
                        body: {
                            type: "object",
                            props: {
                                a: "number",
                                b: "number"
                            }
                        }
                    }
                }
            },
            // based on __dirname
            services: [
                "../test/services/authentification.js",
                "../test/services/maths.js",
            ],
            middlewares: [
                "@authentification.#verify/exists"
            ],
            handler(ctx) {
                // throw new MoleculerError("Error handling", 404, "ERROR_DONE", {
                //     message: "EROOOOOOR"
                // });
                return ctx.call("@maths.#operations/add", ctx.params.event.body);
            }
        }
    }
}
