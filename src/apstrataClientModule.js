//@module

var FAILURE = "failure";
var SUCCESS = "success";
var traceOn = true;

/**
 * @class ApstrataClient
 * @constructor ApstrataClient
 * @param {Object} params: a set of Apstrata parameters
 * {String} params.authKey: the authentication key of the targeted Apstrata application
 * {String} params.id: (optional if token provided) the username or device id of the caller. 
 * {String} params.url: the url of the Apstrata cluster 
 * If an id was initally provided to the constructor, the latter has precedence
 * {String} params.password: (optional if token provided) the password of the caller.
 * {String} params.token: the authentication token for the caller (optional if token and password provided)
 * If id and password are provided, they always take precedence over the token
 * {Boolean} params.isHashedPassword: (optional, defaults to false). If true, means that the provided password is already hashed 
 * This is useful in some scenarios where a user is automatically created in Apstrata further to a successful
 * login at a third party (e.g. Facebook). In that case, a password is automatically generated and its 
 * hashed value is returned to the caller. 
 */
var ApstrataClient = function(params) {

	if (!params || !params.authKey || !params.url) {
		
		throw {
			"errorCode": "MissingParameter",
			"errorDetail":"You need to provide an auth key and the URL of the Apstrata cluster"
		}
	}
	
	if (!params.id) {
		
		throw {
			"errorCode": "MissingParameter",
			"errorDetail":"You need to provide the Apstrata id of the caller"
		}
	}
	
	this.authKey = params.authKey;
	this.url = params.url;
	if (params.id) {
		this.id = params.id;
	}
	
	if (params.password) {
		this.password = params.password;
	}
	
	this.isHashedPassword = params.isHashedPassword ? params.isHashedPassword : false;
	
	if (params.token) {
		this.token = params.token;
	}
};

/**
 * Invokes an Apstrata API with the provided parameters. Caller's credentials must have been specified prior
 * to the call.
 * This method can throw exceptions {errorCode:"xxx", errorDetail:"yyyy"}
 * @method callApi
 * @param {Object} params : the parameters to provide
 * {String} params.operation: the Apstrata API to invoke
 * {Object} params.requestParams: a set of key/value pairs used as parameters of the request to Apstrata
 * {String} params.method: the HTTP method, get/post (optional, defaults to "get")
 * {Boolean} params.headerAuthentication: (optional) defaults to true. If false, callApi will sign with id and password and use the 
 * "traditional" Apstrata request structure (i.e. http://endpoint/authKey/API?apsws.authSig=signature&param=value
 * or http://endpoint/authKey/API?apsws.authSig=signature&param=value) 
 * {Function} params.onSuccess: the callback function if the invocation of Apstrata was successful
 * {Function} params.onFailure: the callback function if the invocation of Apstrata was unsuccessful 
 */
ApstrataClient.prototype.callApi = function(params) {

	if (!params || !params.operation) {
		
		throw {
			"errorCode": "MissingParameter",
			"errorDetail":"You need to provide an operation name"
		}
	};
	
	if (!params || !params.onSuccess || !params.onFailure) {
		
		throw {
			"errorCode": "MissingParameter",
			"errorDetail": "You need to provide a reference to callback function for success and failure"
		}
	};	
	
	// Create an instance of Container for each call, which will be used to invoke messages and follow-up on them
	var container = new Container();
	var containerBehavior = new Behavior();
	var self = this;
	containerBehavior.onComplete = function(container, message, data) {
		
		if (traceOn) {"Message response: " + trace(JSON.stringify(data) + "\n");}
		if (data) {
		
			var response = self.parseApstrataResponse(data);
			if (response.type == FAILURE) {
				params.onFailure(response.result);
			}else {
				params.onSuccess(response.result);
			}
		}
	};
	
	container.behavior = containerBehavior;	
	
	// Check if should not use header authentication
	var useHeaderAuthentication = true;
	if (!params.headerAuthentication && params.headerAuthentication == false) {
		useHeaderAuthentication = false
	}	

	var method = params.method ? params.method : "get";	
	var apstrataServiceUrl = "";
	if (useHeaderAuthentication) {
	
		apstrataServiceUrl = this.getUnsignedURLToAPI(params.operation);
		var signatureAndStamp = this.getSignature({"operation": params.operation, "useToken": true});
		apstrataServiceUrl += "&apsws.time=" + signatureAndStamp.timestamp;
	}else {
		apstrataServiceUrl = this.getSignedURLToAPI(params.operation);
	}
	
	// Prepare message content (signed URL + parameter string)
	var queryParamString = "";
	if (params.requestParams) {	
		queryParamString = this.buildQueryString(params.requestParams);
	}
	
	if (method == "get") {		
		apstrataServiceUrl += queryParamString;
	}
	
	var message = null;	
	message = new Message(apstrataServiceUrl);
	
	// Define specific headers according to method and authorization mode to use
	if (method == "post") {
		
		message.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		message.requestText = queryParamString;
	}
	
	if (useHeaderAuthentication) {
	
		message.setRequestHeader("authorization", "bearer " +  signatureAndStamp.signature);
		if (traceOn){trace("Authorization header: " + message.getRequestHeader("authorization") + "\n");}
	}
	
	message.method = method;
	if(traceOn){trace(apstrataServiceUrl + "\n");}
	try {
		container.invoke(message, Message.JSON);
	}catch(exception) {
		
		throw {
			"errorCode": "RuntimeError",
			"errorDetail": JSON.stringify(exception)
		}	
	}
};


/**
 * Returns a signed URL to an Apstrata API. You still need to add to it the business parameters expected by the API
 * This method is only useful when using the "traditional" invokation of Apstrata  (i.e. http://endpoint/authKey/API?apsws.authSig=signature&param=value
 * or http://endpoint/authKey/API?apsws.authSig=signature&param=value)
 * @method getSignedURLToAPI
 * @param {String} operation : the name of the API to invoke
 * 
 * @return {String} the signed URL to the Apstrata operation, missing the business parameters.
 */
ApstrataClient.prototype.getSignedURLToAPI = function(operation) {

	var authenticationSequence = "";
	var timeStamp = "" + new Date().getTime();
	if (this.id && this.password) {
		
		var signatureObject = this.getSignature({"operation": operation});
		timeStamp = signatureObject.timestamp;
		authenticationSequence = "&apsws.authMode=simple&apsws.authSig=" + signatureObject.signature
	}else {
		authenticationSequence = "&apsdb.authToken=" +  this.token;
	}
	
	var apstrataServiceUrl = this.url + "/" + this.authKey + "/" + operation;
	var queryParamString = "?apsws.time=" + timeStamp + authenticationSequence + "&apsws.id=" + this.id + "&apsws.responseType=json";
	return apstrataServiceUrl + queryParamString;
};

/**
 * @method getUnsignedURLToAPI
 */
ApstrataClient.prototype.getUnsignedURLToAPI = function(operation) {

	return this.url + "/" + operation + "?apsws.responseType=json";
};

/**
 * A utility function that can be used for "GET" requests. It builds a query string (the request parameter string)
 * using the parameter map provided as an input
 * @method buildQueryString
 * @param {Object} requestParams : key/value pairs of the request parameters
 * @return {String} the resulting query string (e.g. "&param1=value1&param2=value2")
 */
ApstrataClient.prototype.buildQueryString = function(requestParams) {

	var queryParamString = "";
	for (param in requestParams) {				
		queryParamString = queryParamString + "&" + param + "=" + requestParams[param];
	}
	
	return queryParamString;
};

/**
 * This method generates the signature of an Apstrata user (device or else) using that latter's credentials
 * If a id and password are provided, the method uses them to generate a signature. If an authentication token
 * is provided, the method generates a base64 encoded signature, to be used in the "authorization" header of
 * the request sent to Apstrata
 * This method can throw exceptions {errorCode:"xxx", errorDetail:"yyyy"}
 * @method getSignature
 * @param {Object} params : the parameters to provide
 * {String} params.operation: the Apstrata API to invoke
 * {String} params.id: (optional if added from constructor) the username or device id of the caller. 
 * If an id was initally provided to the constructor, the latter has precedence
 * {String} params.password: (optional if added from constructor) the password of the caller.
 * If a password was initally provided to the constructor, the latter has precedence
 * {Boolean} params.isHashedPassword: (optional, defaults to false). If true, means that the provider passwod parameter, if any,
 * is already hashed.
 * {String} params.token: (optional if added from constructor) the authentication token of the caller.
 * If a token was initally provided to the constructor, the latter has precedence
 * {Boolean} useToken (optional) defaults to false. If true, will generate a Base64 encoding of authKey-id-token
 * @return {Object} // if generated from id and password
 * 		signature: the signature of the caller given the provided credentials
 *		timestamp: the timestamp used to sign (needed when building the URL to the Apstrata API)
 * @return {Object} // if generated from authentication token
 * 		signature: the base64 encoding of authKey-id-token
 *		timestamp: the timestamp used to sign (needed when building the URL to the Apstrata API)
 */
ApstrataClient.prototype.getSignature = function(params) {

	if (!params || !params.operation) {
		
		throw {
			"errorCode": "MissingParameter",
			"errorDetail":"You need to provide an operation name"
		}
	};
	
	if (!this.id && !params.id) {
		
		throw {
			"errorCode": "MissingParameter",
			"errorDetail":"You need to provide"
		}
	};
	
	var id = this.id ? this.id : id;	
	if (!this.password && !params.password && !this.token && !params.token) {
		
		throw {
			"errorCode": "MissingParameter",
			"errorDetail":"You need to provide a password or a token"
		}
	};
	
	var token = this.token ? this.token : params.token;
	var useToken = params.useToken ? params.useToken : false;	
	if (useToken && !token) {
	
		throw {
			"errorCode": "MissingParameter",
			"errorDetail":"You need to provide a token"
		}
	};
	
	var timestamp = new Date().getTime() + "";
	if (useToken) {
	
		var signature = encodeBase64(this.authKey + ";" + id + ";" + token);
		return {"signature": signature, "timestamp": timestamp};
	}else {
	
		var password = this.password ? this.password : params.password;		
		var signature = "";
		var valueToHash = "";
		var hashedPassword = (params.isHashedPassword || this.isHashedPassword) ? password : KPR.MD5(password).toUpperCase();
		valueToHash = timestamp + id + params.operation + hashedPassword;
		signature = KPR.MD5(valueToHash);
		return {"signature": signature, "timestamp": timestamp};
	}
};
	
/**
 * This method handles the response returned by Apstrata
 * This method can throw an exception {errorCode:"xxx", errorDetail:"yyyy"}
 * @method parseApstrataResponse
 * @param {Object} response: Apstrata response object. If null or invalid, an exception is thrown
 * @return {Object} 
 * If success {"type": "success", "result": the_Apstrata_result}
 * If failure {"type": "error", "result": {"errorCode": "xxx", "errorDetail": "yyyy"}}
 */
ApstrataClient.prototype.parseApstrataResponse = function(response) {

	response = response.response;
	if (!response || !response.metadata) {
		
		var responseStr = response ? JSON.stringify(response) : null;
		trace("Invalid response received. Response: " + responseStr + "\n");
		throw {
			"errorCode": "InvalidFormat",
			"errorDetail": responseStr
		};
	}

	if (response.metadata.status == FAILURE) {		
		
		return {
		
			"type": FAILURE,
			"result": {
				"errorCode": response.metadata.errorCode,
				"errorDetail": response.metadata.errorDetail
			}
		};
	}
	
	return  {
	
		"type": SUCCESS,
		"result": response.result
	}
}

module.exports = ApstrataClient;