const debug = require('debug')('signals');
const curl = require('curl');
const _ = require('lodash');

module.exports = function ({ env, appEmitter }) {
    let { emitException } = appEmitter;
    let { QUOTE_CUR, EXCHANGE, TIMEFRAME, timeframesIntervals } = env;


    // const debug2 = (tf) => _.throttle((msg) => require('debug')('signals:' + tf)(msg), 30e3);


    const params = ({ timeframe, tradingCurrency = QUOTE_CUR, exchangeId = EXCHANGE } = {}) => {
        let timeframeFilter = /1d/i.test(timeframe) || +timeframe === 60 * 24 ? '' : '|' + timeframe;
        return {
            timeframe,
            data: {
                "filter": [
                    { "left": "change" + timeframeFilter, "operation": "nempty" },
                    { "left": "exchange", "operation": "equal", "right": exchangeId.toUpperCase() },
                    { "left": "name,description", "operation": "match", "right": tradingCurrency + "$" }
                ],
                "symbols": { "query": { "types": [] } },
                "columns": [
                    "name"
                    , "close" + timeframeFilter
                    , "change" + timeframeFilter
                    , "high" + timeframeFilter
                    , "low" + timeframeFilter
                    , "volume" + timeframeFilter
                    , "Recommend.All" + timeframeFilter
                    , "exchange"
                    , "description"
                    , "ADX" + timeframeFilter
                    , "ADX-DI" + timeframeFilter
                    , "ADX+DI" + timeframeFilter
                    , "RSI" + timeframeFilter
                    , "EMA10" + timeframeFilter
                    , "EMA20" + timeframeFilter
                    , "MACD.macd" + timeframeFilter
                    , "MACD.signal" + timeframeFilter
                    , "Aroon.Up" + timeframeFilter
                    , "Aroon.Down" + timeframeFilter
                    , "VWMA" + timeframeFilter
                    , "open" + timeframeFilter
                    , "change_from_open" + timeframeFilter
                    , "Volatility.D"
                    , "Stoch.K" + timeframeFilter
                    , "Stoch.D" + timeframeFilter
                    , "Stoch.RSI.K" + timeframeFilter
                    , "Stoch.RSI.D" + timeframeFilter
                    , "Mom" + timeframeFilter
                ],
                "sort": { "sortBy": "change" + timeframeFilter, "sortOrder": "desc" },
                "options": { "lang": "en" },
                "range": [0, 150]
            }
        }

    };

    const beautify = (data, timeframe) => {
        return _(data).map(({ d }) => {
                let id = Math.trunc(Date.now() / timeframesIntervals[timeframe]);
                return {
                    timeframe,
                    symbolId: d[0],
                    now: new Date(),
                    time: new Date(id * timeframesIntervals[timeframe]),
                    id,
                    close: d[1],
                    changePercent: +d[2],//.toFixed(2),
                    changeFromOpen: +d[21],//.toFixed(2),
                    high: d[3],
                    low: d[4],
                    volume: d[5],
                    rating: d[6],
                    signal: signal(d[6]),
                    signalStrength: strength(d[6]),
                    signalString: signalString(d[6]),
                    exchange: d[7].toLowerCase(),
                    description: d[8],
                    ema10: d[13],
                    ema20: d[14],
                    adx: d[9],
                    minusDi: d[10],
                    plusDi: d[11],
                    macd: d[15],
                    macdSignal: d[16],
                    rsi: d[12],
                    volatility: d[22],
                    stochasticK: d[23],
                    stochasticD: d[24],
                    stochasticRSIK: d[25],
                    stochasticRSID: d[26],
                    momentum: d[27],
                    aroonUp: d[17],
                    aroonDown: d[18],
                    vwma: d[19],
                    open: d[20],
                    green: d[21] > 0
                };

                function signal(int) {
                    switch (true) {
                        case int > 0:
                            return 'buy';
                        case int < 0:
                            return 'sell';
                        default:
                            return 'neutral'
                    }
                }

                function strength(int) {
                    switch (true) {
                        case int > .5:
                            return 1;
                        case int < -.5:
                            return 1;
                        default:
                            return 0
                    }
                }

                function signalString(int) {

                    return (strength(int) === 1 ? 'Strong ' : '') + signal(int)
                }
            }
        ).filter(d => d).groupBy('symbolId').mapValues(([v]) => v).value()
    };

    function getSignals({ options = params(), rate = 1e3 } = {}) {
        const url = 'https://scanner.tradingview.com/crypto/scan';
        const { data, timeframe } = options;

        // let debug = getSignals.debug = getSignals.debug || {};
        // debug = debug[timeframe] = debug[timeframe] || debug2(timeframe);
        //
        console.log(`loading signals for timeframe ${timeframe}`)
        curl.postJSON(url, data, (err, res, data) => {
            try {
                if (!err) {
                    let jsonData = JSON.parse(data);
                    if (jsonData.data && !jsonData.error) {
                        let beautifyData = beautify(jsonData.data, timeframe);
                        // let long = longTimeframe ? ':long' : '';
                       console.log(`signals ${timeframe} ${_.keys(beautifyData).length} symbols loaded`);
                        // setImmediate(() => appEmitter.emit('tv:signals' + long, { markets: beautifyData, timeframe }))

                        // beautifyData=_.pick(beautifyData,['AMB/BTC'])
                        // beautifyData = _(beautifyData).orderBy(['volatility', 'volume'], ['desc', 'desc']).mapKeys('symbolId').value()
                        // if (+timeframe === +TIMEFRAME) {
                        //     _.keys(beautifyData).forEach(symbolId => {
                        //         let ticker = beautifyData[symbolId];
                        //         ticker.price = ticker.close;
                        //         ticker.last = ticker.close;
                        //         appEmitter.emit('signals:ticker:' + symbolId, ({ ticker }))
                        //     })
                        // }
                        return setImmediate(() => appEmitter.emit('tv:signals', { markets: beautifyData, timeframe }))
                    }
                    err = jsonData.error;
                }
                if (err) throw(err)
            } catch (ex) {
                getSignals.apply(null, arguments)
                setImmediate(() => appEmitter.emit('tv:signals-error', ex));
                console.log('signals exception:' + timeframe + ' ' + ex);
                emitException(ex)
            } finally {
                // setTimeout(() => getSignals.apply(null, args), rate);
            }
        })
    }

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

    env.TIMEFRAMES.forEach((timeframe) => {
            //get signal max 1 time per second
            const throttledGetSignals = _.throttle(() => getSignals({ options: params({ timeframe }) }), 10e3);

        // setInterval(throttledGetSignals, 1e3)

            throttledGetSignals();

            setTimeout(() => {
                throttledGetSignals();
                setInterval(throttledGetSignals, getRate(timeframe))
            }, getStartTime(timeframe))
        }
    );


    debug('trading on ' + TIMEFRAME + ' trimeframe');

    function getStartTime(timeframe) {
        let remainingTimeToClose = timeframesIntervals[timeframe] - Date.now() % timeframesIntervals[timeframe];
        remainingTimeToClose -= 5e3
        console.log(`Will start loading timeframe ${timeframe} data at ${new Date(Date.now() + remainingTimeToClose).toString() } seconds`)
        return remainingTimeToClose;
        // return 0
    }

    function getRate(timeframe) {
        return timeframesIntervals[timeframe]
    }
}

