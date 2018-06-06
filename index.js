// require('../env')
const formatError = require('format-error').format;


const env = {
    PRODUCTION: !!process.env.PRODUCTION,
    TIMEFRAMES: (process.env.TIMEFRAMES || '1,5,15,60').split(','),
    SYMBOLS_FILTER: process.env.SYMBOLS_FILTER || 'BTC$',
    EXCHANGE: process.env.EXCHANGE || 'binance',
    timeframesIntervals: {
        1: 60e3,
        5: 5 * 60e3,
        15: 15 * 60e3,
        60: 60 * 60e3,
        240: 240 * 60e3,
        [60 * 24]: 60 * 24 * 60e3,
    },
};
const appEmitter = new class extends (require('events')) {
    constructor() {
        super();
        process.on('uncaughtException', (err) => {
            console.error(`m24->\nUncaught Exception ${formatError(err)}`, console.error);
            this.emitException(err);
        });

        process.on('unhandledRejection', (reason, p) => {
            console.error(`m24->\nUnhandled Rejection  ${formatError(reason)}`, console.error);
            this.emitException(reason);
        });
    }

    emitException(ex) {
        console.log(ex, console.error);
        appEmitter.emit('app:error', ex);
    }

    emitMessage(ex) {
        console.log(ex, console.log);
        appEmitter.emit('app:msg', ex);
    }
}();


require('./signals')({ env, appEmitter });
require('./builder')({ env, appEmitter });
require('./saveIndicator')({ env, appEmitter });