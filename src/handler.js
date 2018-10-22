const {
    ServiceBroker
} = require("moleculer");

const Promise = require("bluebird");

const CreateMoleculer = (props) => {
    const broker = new ServiceBroker();
    props.services.forEach((m) => {
        if (m.indexOf(".service") > -1) {
            broker.loadService(m)
        } else {
            broker.loadServices(m);
        }
    });
    return broker;
};

const Handler = (props) => {
    return function(event, context, callback) {
        const broker = CreateMoleculer(props);
        Promise.resolve()
            .then(() => broker.start())
            .then(() => broker.call("lambda-gateway.handle", {
                gateway: props.gateway || undefined,
                action: props.action,
                event: event,
                context: context,
                bodyParsed: props.bodyParsed || false,
                callback: callback
            }))
            .then((r) => {
                return broker.stop()
                    .then(() => console.log("Response from lambda - ", r))
                    .then(() => callback(null, r))
            })
            .catch((e) => {
                //  failed
                console.log("should not failed", e);
            })
    };
}


const Moleculer = (props) => {
    if (Array.isArray(props)) {
        // console.log("Moleculer - is array");
        let functions = {};
        props.forEach((f) => {
            functions[f.functionName] = Handler(f);
        });
        return functions;
    } else {
        // console.log("Moleculer - is function")
        return Handler(props);
    }
}

module.exports = exports = Moleculer;
