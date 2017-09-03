var createCORSRequest = require('./cors');
var httpResponseParser = require('./http_response_parser');
/**
 * @module core/fetch
 * @type {Promise}
 */
module.exports =  function fetch(obj, options) {
  options = options || {};
  options.parser = options.parser || httpResponseParser.parse;
  var request = createCORSRequest(obj.type, obj.url, options);
  if (!request) {
    throw new Error('You cannot perform ajax request on other domains.');
  }
  var config = require('../config').get();
  return new Promise(function (success, failure) {
    //Request error handler
    request.onerror = function (error) {
      failure(error);
    };
    //Request success handler
    request.onload = function () {
      var status = request.status;
      if (status !== 200) {
        if(config.ajaxErrors[status]){
          config.ajaxErrors[status](request.response);
        }
        var err = {};
        err.responseJSON = JSON.parse(request.response);
        err.responseJSON.statusCode = status;
        failure(err);
      }
      var contentType = request.getResponseHeader('content-type');
      var data;
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = options.parser(request);
      } else {
        data = request.responseText;
      }
      success(data);
    };
    //Execute the request.
    request.send(obj.data);
  });

};