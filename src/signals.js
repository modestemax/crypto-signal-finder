const debug = require('debug')('signals');
const _ = require('lodash');
const tvLoader = require('./tv-loader');

module.exports = function ({ env, appEmitter }) {
    let { emitException } = appEmitter;
    let { SYMBOLS_FILTER, EXCHANGE, TIMEFRAME, } = env;


    // const debug2 = (tf) => _.throttle((msg) => require('debug')('signals:' + tf)(msg), 30e3);


    //
    // async function fetchTickers() {
    //     try {
    //         let tickers = await exchange.fetchTickers();
    //         tickers = _.filter(tickers, t => /\/BTC$/i.test(t.symbol));
    //         debug2(`signals 24H_TREND ${_.keys(tickers).length} symbols loaded`);
    //         let pumpings = _.filter(tickers, t => t.percentage > 0);
    //         let meanPercentage = _.sumBy(pumpings, 'percentage') / pumpings.length;
    //         tickers = _.map(tickers, t => _.extend(t, { meanPercentage, pumpingCount: pumpings.length }));
    //         return setImmediate(() => appEmitter.emit('tv:signals_24h', { markets: tickers }))
    //     } catch (ex) {
    //         emitException(ex)
    //     } finally {
    //         setTimeout(fetchTickers, 60e3 * 10);
    //     }
    // }
    //
    // function getOthersSignals({ indicator, rate }) {
    //
    //     appEmitter.once('app:fetch_24h_trend', function () {
    //         // getSignals({ data: params(), signal24h: true, indicator: '24H_TREND', rate: 60e3 * 5 });
    //         fetchTickers();
    //     });
    //
    //     // appEmitter.once('app:fetch_long_trend', function () {
    //     //     switch (Number(TIMEFRAME)) {
    //     //         case 15:
    //     //             getSignals({ options: params({ timeframe: 60 }), longTimeframe: true, indicator, rate });
    //     //             break;
    //     //         case 60:
    //     //             getSignals({ options: params({ timeframe: 240 }), longTimeframe: true, indicator, rate });
    //     //             break;
    //     //     }
    //     // });
    // }
    console.log("TIMEFRAMES", env.TIMEFRAMES)
    env.TIMEFRAMES.forEach((timeframe) => {

        //get signal max 1 time per second
        const throttledGetSignals = _.throttle(() =>
            tvLoader({
                timeframe,
                filter: SYMBOLS_FILTER,
                exchangeId: EXCHANGE
            }).then(
                data => appEmitter.emit('tv:signals', { markets: data, timeframe }),
                err => appEmitter.emit('tv:signals-error', err)
            )
            , 10e3);

        // setInterval(throttledGetSignals, 1e3)

        throttledGetSignals();

        setTimeout(() => {
            throttledGetSignals();
            setInterval(throttledGetSignals, getRate(timeframe))
        }, getStartTime(timeframe))
    }
    );


    function getStartTime(timeframe) {
        return (60e3 - Date.now() % 60e3) - 5e3;
    }

    function getRate(timeframe) {
        switch (+timeframe) {
            case 1:
                return 10e3;
            case 5:
                return 60e3;
            case 15:
                return 3 * 60e3;
            case 60:
                return 10 * 60e3;
            default:
                return 60 * 60e3;
        }
        // return timeframesIntervals[timeframe]
    }
}

