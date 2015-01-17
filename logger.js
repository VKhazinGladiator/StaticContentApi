var config = require('config');
var loggingPath = config.get('logging.path');
var info = require('./package.json');
var q = require('q');
var mkdirp = require('mkdirp');
var path = require('path');
var bunyan = require('bunyan');
var appInfo = require('./package');

exports.getLogger =  function () {

    var deferred = q.defer();
    q.nfcall(mkdirp, path.dirname(loggingPath))
        .catch(function (err) {
            deferred.reject(new Error(err));
        })
        .then(function () {

            var logger = (function () {

                var log = bunyan.createLogger({
                    name: info.name,
                    streams: [
                        {
                            level: 'info',
                            path: loggingPath + '/' + appInfo.name + '.log',
                            type: 'rotating-file',
                            period: config.get('logging.rotationPeriod'),
                            count: config.get('logging.rotationCount')
                        }
                    ]
                });

                return {
                    log: function (msg) {
                        console.log(msg);
                        log.info(msg);
                    }
                }
            }());

            deferred.resolve(logger);
        });
    return deferred.promise;
};