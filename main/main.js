'use strict';

const AWS = require('aws-sdk');

// add new const

const utils = require('../utils');

module.exports.handler = function(event, context, callback){
    try{
        exports.main(event).then(allTotals => {
            // console.log(allTotals)
            var response = {
                statusCode: 200,
                headers: {'Access-Control-Allow-Origin': '*'},
                body: JSON.stringify(
                    allTotals
                ),
            };
            callback(null, response);
        })
    }catch(exception){
        // var response = {
        //     statusCode: 400,
        //     headers: {'Access-Control-Allow-Origin': '*'},
        //     body: JSON.stringify(exception),
        // };
        callback(exception)
    }

}

exports.main = function(event){
    let body = checkInputs(event)
    const dates =  {
        start: new Date(body["startDate"] + " 15:00"),
        end: new Date(body["endDate"] + " 15:00")
    }
    const username = body["username"]
    return exports.getValues(username, dates)
            .then(assetsReturns => getTotalReturn(assetsReturns, dates) )
};

function checkInputs(event){
    // console.log(event)
    utils.checkDefined(event["body"], "body");
    let body = JSON.parse(event["body"])
    // event = event["body"]
    utils.checkDefined(body["startDate"], "startDate");
    utils.checkDefined(body["endDate"], "endDate");
    utils.checkDefined(body["username"], "username");
    console.log("startDate:", body["startDate"]);
    console.log("endDate:", body["endDate"]);
    console.log("username:", body["username"]);
    return body;
}


exports.getValues = function(username, dates){
    var documentClient = new AWS.DynamoDB.DocumentClient();

    var params = {
        TableName: process.env.DAILY_RETURN_TABLE,
        KeyConditionExpression: '#id = :id',
        ExpressionAttributeNames: {
            '#id': 'userId'
        },
        ExpressionAttributeValues: {
          ':id': username
        }
    };
    return new Promise( (resolve, reject) => 
        documentClient.query(params, function(err, data) {
            if (err || typeof data.Items == undefined) 
                reject(Error("<Get asset Returns from table> "+ err));  
            
            console.log(`${data.Items.length} asset returns loaded! typeof: ${typeof data.Items}`);
            resolve(data.Items)
        })
    )
}
function getTotalReturn(returns, dates){
    let allTotals = {}
    for(let day = dates.start; day <= dates.end; day.setDate(day.getDate() + 1)){
        if(day.getDay() == 0 || day.getDay()==6) continue;
        let dailyTotals = {cost: 0.0, return: 0.0, profit: 0.0}
        let foundOne = false
        returns.forEach(r => {
            let assetValues = r.assetValues[utils.dateToString(day)]
            if(assetValues){
                dailyTotals.cost += assetValues.cost;
                dailyTotals.profit += assetValues.profit;
                dailyTotals.return += assetValues.return * assetValues.cost;
                foundOne = true
            }
            else if(foundOne) console.info("Values of", r.assetCode, "not available on day", utils.dateToString(day))
        })
        if(dailyTotals.cost > 0){
            dailyTotals.return /= dailyTotals.cost;
            allTotals[utils.dateToString(day)] = {...dailyTotals};
            console.log("return on", utils.dateToString(day), ":", allTotals[utils.dateToString(day)].return)
        }
    }
    return allTotals;
}

