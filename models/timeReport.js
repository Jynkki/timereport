var mongoose = require('mongoose');
var timeSchema = new mongoose.Schema ({
        id: String,
        date : String,
        deviceType : String,
        deviceId : String,
        eventType : String,
        payload : String,
        timeIn : String,
        timeOut : String,
        totalTime : String
    });

module.exports = mongoose.model('timeReport', timeSchema);

