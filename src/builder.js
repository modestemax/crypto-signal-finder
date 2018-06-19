const debug = require('debug')('analyse');
const _ = require('lodash');
const isSorted = require('is-sorted');
const trend = require('trend');
const Promise = require('bluebird');

const redisLib = require('redis');
const redisClient = redisLib.createClient();
const redis = Promise.promisifyAll(redisClient);

// let { settingsByIndicators: indicatorSettings } = require('./indicators');
// const { openTrades } = require('../trade')
// const trader = require('../trade');
// const { fetchDepth, fetch24HTrend, fetchLongTrend } = require('../utils')();
module.exports = function ({ env, appEmitter }) {
    const { TIMEFRAMES, timeframesIntervals, } = env

    // const signals = _.reduce(TIMEFRAMES, (st, tf) => Object.assign(st, { [tf]: {} }), {});

    appEmitter.on('tv:signals', async ({ markets, timeframe }) => {
        // signals[timeframe] = markets;
        await buildAll(markets);
    });


    async function buildAll(markets) {


        await Promise.each(_.keys(markets), async (symbolId) => {
            // await Promise.each(TIMEFRAMES, async (timeframe) => {
            //     let signal = markets[symbolId];
            //     if (signal) {
            // _.extend(signal, { timeframe });
            await  build({ signal: markets[symbolId] });
            // }
            // });
        })


    }


    async function build({ signal }) {
        // const { symbolId } = signal;
        // const timeframes = TIMEFRAMES;

        backupLastPoints({ signal, count: +signal.timeframe === 1 ? 60 : void 0 });
        buildIndicators({ signal, /*timeframes*/ });

    }


    function getChangePercentage({ high, low }) {
        return (high - low) / Math.abs(low) * 100;
    }

    function backupLastPoints({ limitPointCount = 15, signal, /* timeframes = [5, 15, 60]*/ }) {
        const { symbolId, timeframe } = signal;
        init();
        savePoints();

        // _.forEach(timeframes, savePoints);

        function savePoints(/*timeframe*/) {
            const points = getLastPoints({ symbolId, timeframe });
            // const pivot = getPivotPoint({ symbolId, timeframe });
            // let signal = signals[timeframe][symbolId];

            // _.extend(pivot, signal);

            if (points) {
                if (_.isEmpty(points)) {
                    points.push(signal);
                } else if (_.last(points).id === signal.id) {
                    _.extend(_.last(points), signal);
                } else {
                    points.push(signal);
                    points.splice(0, points.length - limitPointCount);
                }
                (async () => await  redis.setAsync(`points:${symbolId}:${timeframe}`, JSON.stringify(points), 'EX', timeframe * 60 + 30))()
            }
        }

        function init() {
            backupLastPoints.tendances = backupLastPoints.tendances || {};
            backupLastPoints.tendances[symbolId] = backupLastPoints.tendances[symbolId] || {};
            // backupLastPoints.pivot = backupLastPoints.pivot || {};
            // backupLastPoints.pivot[symbolId] = backupLastPoints.pivot[symbolId] || {};

        }

        function getLastPoints({ symbolId, timeframe }) {
            let points = backupLastPoints.tendances [symbolId] [timeframe] = backupLastPoints.tendances [symbolId] [timeframe];
            if (!points) {
                redis.getAsync(`points:${symbolId}:${timeframe}`).then(points => {
                    points = JSON.parse(points || '[]');
                    backupLastPoints.tendances [symbolId] [timeframe] = points;
                })
            }
            return points
        }


        // function getPivotPoint({ symbolId, timeframe }) {
        //     return backupLastPoints.pivot [symbolId] [timeframe] = backupLastPoints.pivot [symbolId] [timeframe] || {};
        // }

        _.defaults(backupLastPoints, { getLastPoints, /*getPivotPoint */});
    }

    function buildIndicators({ signal, /*timeframes = [5, 15, 60],*/ trendingQuote = 3 / 4 }) {

        const { symbolId, timeframe } = signal;
        init();
        // _.forEach(timeframes, (timeframe) => {
        const data = buildSpecialData(timeframe);
        data && appEmitter.emit('analyse:newData', data);
        const gainers = buildIndicators.gainers;
        gainers && appEmitter.emit('analyse:newGainers', gainers);

        // });

        function buildSpecialData(timeframe) {

            const points = backupLastPoints.getLastPoints({ symbolId, timeframe });
            // const pivot = backupLastPoints.getPivotPoint({ symbolId, timeframe });
            // const points = backupLast3Points.getLast3UniqPoints({ symbol, timeframe, uniqCount: timeframe < 60 ? 3 : 2 });
            // const [last] = points.slice(-1);
            const last = _.last(points);
            if (last) {
                const specialData = getSpecialData({ symbolId, timeframe });

                _.extend(specialData, { points, candle: last });
                close();
                ema();
                rsi();
                macd();
                adx();
                stochastic();
                stochasticRSI();
                momentum();
                // topGainers();

                return specialData;

                // function topGainers() {
                //     const changes = buildIndicators.changes = buildIndicators.changes || {};
                //     specialData.changes = changes[symbolId] = changes[symbolId] || {};
                //     if (+timeframe === 5) {
                //         _.extend(changes[symbolId], _.range(1, 13).reduce((change, i) =>
                //                 (_.extend(change, { [`last${i * 5}mChange`]: _(points).slice(-i).sumBy('changeFromOpen') }))
                //             , { symbolId }));
                //     }
                //     if (+timeframe === 1) {
                //         _.extend(changes[symbolId], _.range(1, 5).reduce((change, i) =>
                //                 (_.extend(change, { [`last${i}mChange`]: _(points).slice(-i).sumBy('changeFromOpen') }))
                //             , { symbolId }));
                //     }
                //     buildIndicators.gainers = _.range(1, 13).reduce((gainers, i) => {
                //         const key = `last${i * 5}mChange`;
                //         gainers[key] = _.orderBy(_.values(changes), key, 'desc').filter(change => change[key] > 0);
                //         return gainers
                //     }, {});
                //
                // }


                function close() {
                    _.extend(specialData, {},
                        getTrendStatus({ trendingQuote, indicator: 'close', points }),
                    );

                }

                function ema() {
                    _.extend(specialData, {
                            ema10Above20: last.ema10 > last.ema20,
                            ema10BelowPrice: last.ema10 < last.close,
                            ema10AbovePrice: last.ema10 > last.close,
                            ema20AbovePrice: last.ema20 > last.close,
                            ema20BelowPrice: last.ema20 < last.close,
                            ema10CloseDistance: getChangePercentage({ high: last.close, low: last.ema10 }),
                            ema10Ema20Distance: getChangePercentage({ high: last.ema10, low: last.ema20 })
                        },
                        getTrendStatus({ trendingQuote, indicator: 'ema10', points }),
                        getTrendStatus({ trendingQuote, indicator: 'ema20', points }),
                        getCrossingPoint({ indicatorUp: 'ema10', indicatorDown: 'ema20', points }),
                        getCrossingPoint({ indicatorUp: 'close', indicatorDown: 'ema10', points }),
                    );

                }

                function rsi() {
                    const RSi_HIGH_REF = 70;
                    const RSi_LOW_REF = 30;
                    _.defaults(buildIndicators, { RSi_HIGH_REF, RSi_LOW_REF });
                    _.extend(specialData, {
                            rsiAboveHighRef: last.rsi > RSi_HIGH_REF,
                            rsiBelowHighRef: last.rsi < RSi_HIGH_REF,
                            rsiAboveLowRef: last.rsi > RSi_LOW_REF,
                            rsiBelowLowRef: last.rsi < RSi_LOW_REF,
                            maxRsi: last.rsi < RSi_HIGH_REF ? null : _.max([last.rsi, specialData.maxRsi]),
                        },
                        getTrendStatus({ trendingQuote, indicator: 'rsi', points }),
                        getCrossingPoint({ indicatorUp: 'rsi', indicatorDown: 'point60', points, indicatorDownValue: 60 }),
                        getCrossingPoint({
                            indicatorUp: 'rsi',
                            indicatorDown: 'highRef',
                            points,
                            indicatorDownValue: RSi_HIGH_REF
                        }),
                        getCrossingPoint({
                            indicatorUp: 'rsi',
                            indicatorDown: 'lowRef',
                            points,
                            indicatorDownValue: RSi_LOW_REF
                        }),
                    );
                    let { rsi_point60CrossingDistance, rsiAboveHighRef, rsiBelowHighRef, rsiCrossingHighRefDistance } = specialData;
                    _.extend(specialData, {
                        rsiEstAGauche: (
                            rsi_point60CrossingDistance > 0 && rsiBelowHighRef && (!rsiCrossingHighRefDistance || rsiCrossingHighRefDistance > 0)
                        )
                        || (rsiAboveHighRef && last.rsi === specialData.maxRsi)
                    });

                }

                function macd() {

                    _.extend(specialData, {
                            macdAboveSignal: last.macd > last.macdSignal,
                            macdBelowSignal: last.macd < last.macdSignal,
                            macdAboveZero: last.macd > 0,
                            macdBelowZero: last.macd < 0,
                            macdSignalAboveZero: last.macdSignal > 0,
                        },
                        getTrendStatus({ trendingQuote, indicator: 'macd', points }),
                        getTrendStatus({ trendingQuote, indicator: 'macdSignal', points }),
                        getCrossingPoint({ indicatorUp: 'macd', indicatorDown: 'macdSignal', points }),
                    );

                }

                function adx() {
                    const ADX_REF = 25;
                    _.defaults(buildIndicators, { ADX_REF });
                    _.extend(specialData, {
                            plusDiAboveMinusDi: last.plusDi > last.minusDi,
                            plusDiAboveAdxRef: last.plusDi > ADX_REF,
                            minusDiBelowAdxRef: last.plusDi < ADX_REF,
                            plusDiAboveAdx: last.plusDi > last.adx,
                            diDistance: last.plusDi - last.minusDi,
                        },
                        getTrendStatus({ trendingQuote, indicator: 'plusDi', points }),
                        getTrendStatus({ trendingQuote, indicator: 'minusDi', points }),
                        getCrossingPoint({ indicatorUp: 'plusDi', indicatorDown: 'minusDi', points }),
                    );

                    _.extend(specialData, {
                            adxAboveRef: last.adx > ADX_REF,
                            minusDiBelowAdxRef: last.plusDi < ADX_REF,
                            plusDiAboveAdx: last.plusDi > last.adx,
                            diDistance: last.plusDi - last.minusDi,
                        },
                        getTrendStatus({ trendingQuote, indicator: 'adx', points }),
                        getCrossingPoint({ indicatorUp: 'adx', indicatorDown: 'adxRef', points, indicatorDownValue: ADX_REF }),
                    );
                }

                function stochastic() {
                    const STOCHASTIC_LOW_REF = 20;
                    const STOCHASTIC_HIGH_REF = 80;
                    _.defaults(buildIndicators, { STOCHASTIC_LOW_REF, STOCHASTIC_HIGH_REF });
                    _.extend(specialData, {
                            stochasticKAboveD: last.stochasticK > last.stochasticD,
                            stochasticKBelowD: last.stochasticK < last.stochasticD,
                            stochasticKAboveHighRef: last.stochasticK > STOCHASTIC_HIGH_REF,
                            stochasticKBelowHighRef: last.stochasticK < STOCHASTIC_HIGH_REF,
                            stochasticKAboveLowRef: last.stochasticK > STOCHASTIC_LOW_REF,
                            stochasticKBelowLowRef: last.stochasticK < STOCHASTIC_LOW_REF,
                        },
                        getTrendStatus({ trendingQuote, indicator: 'stochasticK', points }),
                        getTrendStatus({ trendingQuote, indicator: 'stochasticD', points }),
                        getCrossingPoint({ indicatorUp: 'stochasticK', indicatorDown: 'stochasticD', points }),
                        getCrossingPoint({
                            indicatorUp: 'stochasticK',
                            indicatorDown: 'highRef',
                            points,
                            indicatorDownValue: STOCHASTIC_HIGH_REF
                        }),
                        getCrossingPoint({
                            indicatorUp: 'stochasticK',
                            indicatorDown: 'lowRef',
                            points,
                            indicatorDownValue: STOCHASTIC_LOW_REF
                        }),
                    );
                }

                function stochasticRSI() {
                    const STOCHASTICRSI_LOW_REF = 20;
                    const STOCHASTICRSI_HIGH_REF = 80;
                    _.defaults(buildIndicators, { STOCHASTICRSI_LOW_REF, STOCHASTICRSI_HIGH_REF });
                    _.extend(specialData, {
                            stochasticRSIKAboveD: last.stochasticRSIK > last.stochasticRSID,
                            stochasticRSIKBelowD: last.stochasticRSIK < last.stochasticRSID,
                            stochasticRSIKAboveHighRef: last.stochasticRSIK > STOCHASTICRSI_HIGH_REF,
                            stochasticRSIKBelowHighRef: last.stochasticRSIK < STOCHASTICRSI_HIGH_REF,
                            stochasticRSIKAboveLowRef: last.stochasticRSIK > STOCHASTICRSI_LOW_REF,
                            stochasticRSIKBelowLowRef: last.stochasticRSIK < STOCHASTICRSI_LOW_REF,

                        },
                        getTrendStatus({ trendingQuote, indicator: 'stochasticRSIK', points }),
                        getTrendStatus({ trendingQuote, indicator: 'stochasticRSID', points }),
                        getCrossingPoint({ indicatorUp: 'stochasticRSIK', indicatorDown: 'stochasticRSID', points }),
                        getCrossingPoint({
                            indicatorUp: 'stochasticRSIK',
                            indicatorDown: 'highRef',
                            points,
                            indicatorDownValue: STOCHASTICRSI_HIGH_REF
                        }),
                        getCrossingPoint({
                            indicatorUp: 'stochasticRSIK',
                            indicatorDown: 'lowRef',
                            points,
                            indicatorDownValue: STOCHASTICRSI_LOW_REF
                        }),
                    );
                }

                function momentum() {
                    const MOMENTUM_MEDIAN = 0
                    _.defaults(buildIndicators, { MOMENTUM_MEDIAN, });
                    _.extend(specialData, {
                            momentumAboveZero: last.momentum > 0,
                            momentumBelowZero: last.momentum < 0,
                        },
                        getTrendStatus({ trendingQuote, indicator: 'momentum', points }),
                        getCrossingPoint({ indicatorUp: 'rsi', indicatorDown: 'point60', points, indicatorDownValue: 60 }),
                        getCrossingPoint({
                            indicatorUp: 'momentum',
                            indicatorDown: 'median',
                            points,
                            indicatorDownValue: MOMENTUM_MEDIAN
                        }),
                    );
                }
            }
        }


        function init() {
            buildIndicators.specialData = buildIndicators.specialData || {};
            buildIndicators.specialData[symbolId] = buildIndicators.specialData[symbolId] || {};
        }

        function getSpecialData({ symbolId, timeframe }) {
            return buildIndicators.specialData[symbolId][timeframe] =
                buildIndicators.specialData[symbolId][timeframe] || { symbolId, timeframe };
        }

        _.defaults(buildIndicators, { getSpecialData, });

    }

    function getTrendStatus({ trendingQuote, indicator, points, last, reversed = false }) {
        try {
            let max = _.maxBy(points, indicator)[indicator];
            let min = _.minBy(points, indicator)[indicator];
            let avgMinimum = max * trendingQuote + min * (1 - trendingQuote);
            let trendRes = trend(_.map(_.compact([].concat(points, last)), indicator), {
                avgMinimum,
                reversed,
                lastPoints: last ? 2 : 1
            });
            return { [`${indicator}Trend`]: trendRes, [`${indicator}IsTrendingUp`]: trendRes > 1 }
        } catch (e) {

        }

    }

    function getCrossingStatus({ indicatorUp, indicatorDown, zero = 0 }) {
        let [upPrev, upCurr] = indicatorUp.slice(-2);
        let [downPrev, downCurr] = indicatorDown.slice(-2);
        let prevChange = getChangePercentage({ high: upPrev, low: downPrev });
        let lastChange = getChangePercentage({ high: upCurr, low: downCurr });
        let crossingUp = prevChange <= zero && lastChange > zero;
        let crossingDown = prevChange >= -zero && lastChange < zero;
        return { crossingUp, crossingDown };
    }


    function getCrossingPoint({ indicatorUp, indicatorDown, points, indicatorDownValue, timeframe, zero }) {
        let iDown = _.capitalize(indicatorDown)
        if (points.length >= 2) {
            let [prevPoint, lastPoint] = points.slice(-2);
            let { crossingDown, crossingUp } = getCrossingStatus({
                indicatorUp: [prevPoint[indicatorUp], lastPoint[indicatorUp]],
                indicatorDown: [prevPoint[indicatorDown] || indicatorDownValue, lastPoint[indicatorDown] || indicatorDownValue],
                zero
            });
            if (crossingUp || crossingDown) {

                return _.extend({
                    [`${indicatorUp}IsCrossing${iDown}`]: true,
                    [`${indicatorUp}IsCrossingUp${iDown}`]: crossingUp,
                    [`${indicatorUp}IsCrossingDown${iDown}`]: crossingDown,
                    [`${indicatorUp}${iDown}CrossingDistance`]: countCandle({ candle: lastPoint, crossingUp })
                });
            } else {
                return getCrossingPoint({ indicatorUp, indicatorDown, points: _.initial(points), zero })
            }
        }
        return {
            [`${indicatorUp}IsCrossing${iDown}`]: false,
        };
    }


    function countCandle({ candle, crossingUp }) {
        if (candle) {
            const id = candle.id;
            const count = 1 + Math.trunc((Date.now() / (timeframesIntervals[candle.timeframe]))) - id;

            return crossingUp ? count : -count;
        }
        return null
    }


}