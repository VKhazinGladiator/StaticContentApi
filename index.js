//To run in-prod: https://github.com/zapty/forever-service

//Dependencies
var restify = require('restify');
var cors = require('cors');
var config = require('config');
var appInfo = require('./package.json');
var url = require('url');
var couchbase = require('couchbase');

//Configuration
var port = process.env.port || 1433;
var server = restify.createServer();

//Plug-ins
server.use(restify.queryParser());
server.use(restify.bodyParser());
server.use(restify.CORS());

//Variables and constants
var reservedProperties = ['Id', 'AppKey', 'Module', 'JsonType'];

require('./logger').getLogger()
    .then(function(logger) {

    /******************************************************************************
    Routes
    ******************************************************************************/
    server.get('/', echo);
    server.get('/echo', echo);
    server.get(/(.*)/, getStaticContent);

    /******************************************************************************
    Utilities
    ******************************************************************************/
    function execute(action, success, error) {
        try {
            var result = action();
            if (success != null)
                success(result);
        } catch (err) {
            console.error(err);
            if (error != null)
                error(err);
        }
    }
    
    
    /*****************************************************************************/

    /******************************************************************************
        End-points
    ******************************************************************************/
    //Echo
    function echo(req, res) {
        
        var action = function() {
            return {
                name: appInfo.name,
                version: appInfo.version,
                description: appInfo.description,
                author:{
                    name: appInfo.author.name,
                    email: appInfo.author.email,
                }
            };
        };

        var success = function(info) {
            res.send(info);
        };
        var error = function(err) {
            res.send(err);
        };
        var result = execute(action, success, error);
    }

    function getStaticContent(req, res, next) {

        var action = function () {

            var parsedUrl = url.parse(req.url, true);
            var segments = parsedUrl.pathname.split('/');
            
            if (segments.length < 3)
                return next(new restify.errors.BadRequestError('Missing appKey and/or module!'));
                
            //res.send(segments);
            
            var appKey = segments[1];
            var appModule = segments[2];
            var itemKey = parsedUrl.query.key;
            var lang = parsedUrl.query.lang;
            
            var queryKey = 'appKey:{appKey}::module:{module}'
                            .replace('{appKey}', appKey.toLowerCase())
                            .replace('{module}', appModule.toLowerCase());
            
            var cbCluster = new couchbase.Cluster(config.couchbase.host);
            var cbBucket = cbCluster.openBucket(config.couchbase.bucket); 
            var cbQuery = couchbase.ViewQuery.from(
                    config.couchbase.staticContentDesignName, 
                    config.couchbase.staticContentViewName
                )
                .key(queryKey)
                .limit(1);

            cbBucket.query(cbQuery, function(err, results) {
                    if (err) {
                        logger.log(err);
                        return next(new restify.errors.InternalServerError(err.message));
                    } else {
                        if (results.length == 0) {
                            return next(new restify.errors.NotFoundError('AppKey/module not found!'));
                        } else {
                            
                            var value = results[0].value;
                            
                            //Remove system properties
                            reservedProperties.forEach(function(propertyKey) {
                                delete value[propertyKey];
                            })
                            
                            //Remove other properties when itemKey is provided
                            if (itemKey != null) {
                                for (var propertyKey in value) {
                                    if (itemKey !== propertyKey) {
                                        delete value[propertyKey];
                                    }
                                }
                            }
                            
                            //Remove other languages when lang is provided
                            if (lang != null) {
                                for (var propertyKey in value) {
                                    value[propertyKey] = value[propertyKey].filter(function(languageElement){
                                        return languageElement.LanguageCode === lang;                                       
                                    });
                                }
                            }
                            res.send(value);
                        }
                    }
                });
        };

        var success = function (err) {
            //cannot finish request because of promise
            //res.end();
        };

        var error = function (err) {
            res.send(err);
        };

        execute(action, success, error);
    }

    //Start server
    server.listen(port, function () {
        logger.log('listening on port: ' + port);
    });
});