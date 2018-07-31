console.log('Starting App');

const formatError = require('format-error').format;
const { timeframesIntervals } = require('common/settings');

const env = {
    PRODUCTION: !!process.env.PRODUCTION,
    TIMEFRAMES: (process.env.TIMEFRAMES || '1,5,15,60').split(','),
    SYMBOLS_FILTER: process.env.SYMBOLS_FILTER || 'BTC$',
    EXCHANGE: process.env.EXCHANGE || 'binance',
    timeframesIntervals,
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