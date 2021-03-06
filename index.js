'use strict';
var request = require("request");

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: 'SSML',
            ssml: output,
        },
        card: {
            type: 'Simple',
            title: 'SessionSpeechlet - ${title}',
            content: 'SessionSpeechlet - ${output}',
        },
        reprompt: {
            outputSpeech: {
                type: 'SSML',
                ssml: repromptText,
            },
        },
        shouldEndSession,
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: '1.0',
        sessionAttributes,
        response: speechletResponse,
    };
}

function getWelcomeResponse(callback) {
    var cardTitle = 'Welcome';
    var speechOutput = '<speak>Welcome to the Bayocat Break In.</speak>';
    var repromptText = '<speak>You can create a game by saying, begin game, followed by your name.</speak>';
    var shouldEndSession = false;
    callback({}, buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function handleSessionEndRequest(callback) {
    var cardTitle = 'Game Ended';
    var speechOutput = '<speak>Thank you for playing Bayocat Break In!</speak>';
    callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, true));
}

function inSession(intent, session, callback) {
    var host = "http://beocat.kyle-eisenbarger.com";

    switch (intent.name) {
        case "BeginGame":
            var cardTitle = "Begin Game";
            var gameName = intent.slots.GameName.value;
            var route = "/api/begin";
            var url = {
                url: host + route,
                headers: {
                    'game-name': gameName,
                    'alexa-id' : session.user.userId
                }
            };
            apiRequest(url, function(error, response, body) {
                if (error !== null) {
                    console.error("ERROR: " + error);
                }
                console.info("RESPONSE: " + response);
                console.info("BODY: " + body);
                var data = JSON.parse(body);
                var intro = data['intro'];
                var user_response = data['user-response'];
                var speechOutput = "<speak><p>Your game, " + gameName + ", has been created!</p><p>" + intro + "</p><p>" + user_response + "</p></speak>";
                var repromptText = "<speak>You can hear available commands by saying, help.</speak>";
                callback({}, buildSpeechletResponse(cardTitle, speechOutput, repromptText, false));
            });
            break;
        case "PlayGame":
            var route = "/api/play";

            var gameMove = intent.slots.move.value;
            var url = {
                url: host + route,
                headers: {
                  'alexa-id' : session.user.userId,
                  'user-request': gameMove

                }
            };

            apiRequest(url, function(error, response, body) {
                if (error !== null) {
                    console.error("ERROR: " + error);
                }
                console.info("RESPONSE: " + response);
                console.info("BODY: " + body);
                var data = JSON.parse(body);
                var user_response = data['user-response'];
                var speechOutput = "<speak><p>" + user_response + "</p></speak>";
                var repromptText = "<speak>You can hear available commands by saying, help.</speak>";
                callback({}, buildSpeechletResponse(cardTitle, speechOutput, repromptText, false));
                });


            break;
        case "EndGame":
            var route = "/api/end";

            //var gameMove = intent.slots.move.value;
            var url = {
                url: host + route,
                headers: {
                  'alexa-id' : session.user.userId,
                  'user-request': "end"

                }
            };

            apiRequest(url, function(error, response, body) {
                if (error !== null) {
                    console.error("ERROR: " + error);
                }
                console.info("RESPONSE: " + response);
                console.info("BODY: " + body);
                var data = JSON.parse(body);
                var speechOutput = "<speak><p>" + "You have ended the game." + "</p></speak>";
                var repromptText = "<speak>You can hear available commands by saying, help.</speak>";
                callback({}, buildSpeechletResponse(cardTitle, speechOutput, repromptText, true));
                });


            break;
    }
}

function apiRequest(url, callback) {
    console.log("Starting request to " + url.url);
    request.post(url, function(error, response, body) {
        callback(error, response, body);
    });
}

function onSessionStarted(sessionStartedRequest, session) {
    console.log(`onSessionStarted requestId=${sessionStartedRequest.requestId}, sessionId=${session.sessionId}`);
}

function onLaunch(launchRequest, session, callback) {
    console.log(`onLaunch requestId=${launchRequest.requestId}, sessionId=${session.sessionId}`);
    getWelcomeResponse(callback);
}

function onIntent(intentRequest, session, callback) {
    console.log(`onIntent requestId=${intentRequest.requestId}, sessionId=${session.sessionId}`);

    const intent = intentRequest.intent;
    const intentName = intentRequest.intent.name;

    if (intentName === 'BeginGame' || intentName === 'EndGame' || intentName === 'PlayGame') {
        inSession(intent, session, callback);
    } else {
        callback({}, buildSpeechletResponse("Beocat Break In", "Invalid command, " + intentName, true));
        throw new Error('Invalid intent');
    }
}

function onSessionEnded(sessionEndedRequest, session) {
    console.log('onSessionEnded requestId=${sessionEndedRequest.requestId}, sessionId=${session.sessionId}');
}

exports.handler = (event, context, callback) => {
    try {
        console.log('event.session.application.applicationId=${event.session.application.applicationId}');
        if (event.session.application.applicationId !== 'amzn1.ask.skill.bcee7169-243a-4d01-9dd3-6a0d899c1fc4') {
            callback('Invalid Application ID');
        }
        if (event.session.new) {
            onSessionStarted({
                requestId: event.request.requestId
            }, event.session);
        }
        if (event.request.type === 'LaunchRequest') {
            onLaunch(event.request,
                event.session,
                (sessionAttributes, speechletResponse) => {
                    callback(null, buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === 'IntentRequest') {
            onIntent(event.request,
                event.session,
                (sessionAttributes, speechletResponse) => {
                    callback(null, buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === 'SessionEndedRequest') {
            onSessionEnded(event.request, event.session);
            callback();
        }
    } catch (err) {
        callback(err);
    }
};
