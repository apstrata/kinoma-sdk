skinoma-sdk
==========

SDK for KinomaCreate devices to connect to Apstrata

How to add the client to your Kinoma project
============================================

Option 1.  
* Import the Kinoma Apstrata client as a new project in Kinoma Studio. 
* In you application project, create a reference to the latter.

Option 2.
* Copy the "apstrataClientModule.js" file into the "src" folder of your Kinoma application project

Create an instance of the client
================================

Require the apstrataClientModule module

```javascript
var ApstrataClient = require("apstrataClientModule");
```
Create an instance of the ApstrataClient class. There are multiple ways of doing this:


**Option 1. Using a device id (or user id) and an authentication token**

When you created a device on Apstrata, you provided a device id and got an authentication token in return.
If you need to authenticate against Apstrata on behalf of a user (not a device), pass the user's id
You will need to pass these to the constructor of the ApstrataClient class, as well as your Apstrata authentication
key and the URL to the Apstrata cluster you will be using:

```javascript
var URL = "https://wot.apstrata.com/apsdb/rest"; // Replace with appropriate URL if needed
var AUTH_KEY = "A7307F650"; // Replace with your Authentication key
var ID = "myDevice"; // Replace with appropriate value
var TOKEN = "A93890C3E486D4B6948E4B6956D8E54F"; // Replace with your authentication token
var apstrataClient = new ApstrataClient({"authKey":AUTH_KEY, "id":ID, "token":TOKEN, "url":URL});
```

**Option 2. Using a device id (or user id) and a password**

When you created a device on Apstrata, you provided a device id and also a password. You can use this latter
to sign you calls to Apstrata instead of the authentication token

```javascript
var URL = "https://wot.apstrata.com/apsdb/rest"; // Replace with appropriate URL if needed
var AUTH_KEY = "A7307F650"; // Replace with your Authentication key
var ID = "myDevice"; // Replace with appropriate value
var PWD = "myPassw0rd"; // Replace with your authentication token
var apstrataClient = new ApstrataClient({"authKey":AUTH_KEY, "id":ID, "password":PWD, "url":URL});
```
**Option 3. Using a device id (or user id) only**

You might decide to provide the secret (token or password) just before invoking Apstrata. In that case,
you only need to provide the device (or user) id

```javascript
var URL = "https://wot.apstrata.com/apsdb/rest"; // Replace with appropriate URL if needed
var AUTH_KEY = "A7307F650"; // Replace with your Authentication key
var ID = "myDevice"; // Replace with appropriate value
var apstrataClient = new ApstrataClient({"authKey":AUTH_KEY, "id":ID, "url":URL});
```
Calling an Apstrata API
======================

To call an Apstrata API, you just have to invoke the callAPI() method on your ApstrataClient instance, providing it with the name of the API (operation) to invoke, the parameters that latter expects and a two callbacks, one for the success case and the other for the failure case.

```javascript
try {
        // Define a callback function to handle successful cases
    		var onSuccess = function(response) {
			     // do somethig
			  };
			     
			  // Define a callback function to handle failures     
		    var onFailure = function(response) {
		      // do something else    
  		  };
		        
		    // Create an instance of the ApstrataClient   
	      var apstrataClient = new ApstrataClient({"authKey":AUTH_KEY, "id":ID, "token":TOKEN, "url":URL});
	      
	      // Prepare the parameters to pass
	      var params = {
	            	
	       		"operation":"RunScript", // We assume that we are calling Apstrata's RunScript API
	       		"requestParams": {
	         			"apsdb.scriptName": "myScript", // Replace this with the name of one of your Apstrata scripts 
	         			"someParam":"someValue", // We assume this is expected by "myScript"
	          },
	          "onSuccess": onSuccess,
	          "onFailure": onFailure
	      };
	            	
	      apstrataClient.callApi(params);
	}catch(exception){
  	// Handle exception
  }



