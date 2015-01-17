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

    //getStaticContent
    function getStaticContent(req, res, next) {

        var action = function () {

            var parsedUrl = url.parse(req.url, true);
            var segments = parsedUrl.pathname.split('/');
            
            if (segments.length < 3)
                return next(new restify.errors.BadRequestError('Missing bucket and/or module!'));
                
            //res.send(segments);
            
            var bucket = segments[1];
            var _module = segments[2];
            var key = parsedUrl.query.key;
            var lang = parsedUrl.query.lang;
            
        var cbCluster = new couchbase.Cluster(config.couchbase.host);
        var cbBucket = cbCluster.openBucket(config.couchbase.bucket); 
        var cbQuery = couchbase.ViewQuery.from(config.couchbase.staticContentDesignName, config.couchbase.staticContentViewName).limit(1);

        cbBucket.query(cbQuery, function(err, results) {
                if (err) {
                    logger.log(err);
                    return next(new restify.errors.InternalServerError(err.message));
                } else {
                    if (results.length == 0) {
                        return next(new restify.errors.NotFoundError('Bucket/module/key not found!'));
                    } else {
                        res.send(results[0]);
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