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
                action: props.action,
                event: event,
                context: context,
                callback: callback
            }))
            .catch((e) => {
                //  failed
                console.log("should not failed", e);
            })
    };
}

module.exports = exports = Handler;