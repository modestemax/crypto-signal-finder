const debug = require('debug')('signals');
const redisLib = require('redis');
const _ = require('lodash');
const Promise = require('bluebird');


module.exports = function ({ env, appEmitter }) {
    let { emitException } = appEmitter;
    let { EXCHANGE, timeframesIntervals } = env;
    const redisClient = redisLib.createClient();
    const redis = Promise.promisifyAll(redisClient);

    appEmitter.on('analyse:newData', async (data) => {
        const { symbolId, timeframe, time, id } = data.candle;

        const prevTime = new Date((id - 1) * timeframesIntervals[timeframe]);
        const [prevKey, key] = [prevTime, time].map(getKey({ EXCHANGE, symbolId, timeframe }));

        _.extend(data, {
            __key__: key,
            __prev_key__: prevKey,
        });
        const strData = JSON.stringify(_.omit(data, ['points']));
        await redis.publish(`newData:m${timeframe}`, strData);
        await redis.setAsync(key, strData, 'EX', 7 * 24 * 60 * 60); //last 7 days
        //console.log(key + ' saved');
    });


    function getKey({ EXCHANGE, symbolId, timeframe }) {
        return function (time) {
            if (!time) {
                time = new Date(Math.trunc(Date.now() / timeframesIntervals[timeframe]) * timeframesIntervals[timeframe])
            }
            time = new Date(time);
            const timeKey = `${time.getDate()}/${time.getMonth() + 1}:${time.getHours()}h${time.getMinutes()}`;
            return `${EXCHANGE}:${symbolId}:${timeKey}:m${timeframe}`;

        }
    }
};

