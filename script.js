var alldata = [];
var statewise = {};
var maxConfirmed = 0;
var lastUpdated = "";

var confirmed_delta = 0;
var deaths_delta = 0;
var recovered_delta = 0;
var states_delta = 0;


// make sure to use Prod before submitting

// var sheet_id = "ob1elpb"; // Test
var sheet_id = "ovd0hzm"; // Prod

$.getJSON("https://spreadsheets.google.com/feeds/cells/1nzXUdaIWC84QipdVGUKTiCSc5xntBbpMpzLm6Si33zk/"+sheet_id+"/public/values?alt=json",
function(result) {
    entries = result["feed"]["entry"]
    entries.forEach(function(item) {
        if (alldata[(item["gs$cell"]["row"] - 1)] == null) {
            alldata[(item["gs$cell"]["row"] - 1)] = [];
        }
        alldata[(item["gs$cell"]["row"] - 1)][(item["gs$cell"]["col"] - 1)] = (item["gs$cell"]["$t"]);
    });
    maxConfirmed = alldata[2][1];
    lastUpdated = getLocalTime(alldata[1][5]);
    confirmed_delta = alldata[1][6];
    deaths_delta = alldata[1][7];
    recovered_delta = alldata[1][8];
    states_delta = alldata[1][9];

    for(var i = 0; i<alldata.length;i++){
        alldata[i].splice(5); // Keep only 5 columns. State, Confirmed, Recovered, Deaths, Active
    }
    alldata.forEach(function(data){
        statewise[data[0]] = data;
    });
    var numStatesInfected = 0;

    var tablehtml = "<thead>";
    for (var i = 0; i < alldata.length; i++) {
        if (i == 0) {
            tablehtml += "<tr>";
            alldata[i].forEach(function(data) {
                tablehtml += "<th>" + data + "</th>";
            });
            tablehtml += "</tr></thead><tbody>";
        } else {
            if (i == 1) {
                continue;
            }
            tempdata = Array.from(alldata[i]);

            tempdata.splice(0, 1);
            allzero = true;
            tempdata.forEach(function(data) {
                if (data != 0) {
                    allzero = false;
                }
            });
            if (!allzero) {
                numStatesInfected++;
                tablehtml += "<tr>";
                alldata[i].forEach(function(data) {
                    tablehtml += "<td>" + data + "</td>";
                });
                tablehtml += "</tr>";
            }
        }
    }
    tablehtml += '<tr class="totals">';
    alldata[1].forEach(function(data) {
        tablehtml += "<td>" + data + "</td>";
    });
    tablehtml += "</tr>";

    tablehtml += "</tbody>";
    alldata.forEach(function(item) {
        tablehtml += item[0];
    });
    // console.log(numStatesInfected);
    $("table#prefectures-table").html(tablehtml);
    $("div#states-value").html(numStatesInfected);
    $("div#confvalue").html(alldata[1][1]);
    $("div#deathsvalue").html(alldata[1][3]);
    $("div#recoveredvalue").html(alldata[1][2]);
    $("strong#last-updated").html(lastUpdated);

    if(confirmed_delta)$("div#confirmed_delta").html("( +"+confirmed_delta+")");
    if(deaths_delta) $("div#deaths_delta").html("( +"+deaths_delta+")");
    if(recovered_delta)$("div#recovered_delta").html("( +"+recovered_delta+")");
    if(states_delta)$("div#states_delta").html("( +"+states_delta+")");


    initMapStuff();

});

function is_touch_device() {
    try {
        document.createEvent("TouchEvent");
        return true;
    } catch (e) {
        return false;
    }
}

function initMapStuff(){
    var map = L.map('map').setView([22.5, 82], 3);
    map.setMaxBounds(map.getBounds());
    map.setView([22.5, 82], 4);

    if(is_touch_device()){
        map.dragging.disable();
        map.tap.disable();
    }

    L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoianVuYWlkYmFidSIsImEiOiJqc2ZuNkhFIn0.rdicmW4uRhYuHZxEK9dRbg', {
    maxZoom: 6,
    minZoom: 4,
    id: 'mapbox/light-v9',
    tileSize: 512,
    zoomOffset: -1
}).addTo(map);


// control that shows state info on hover
var info = L.control();

info.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'info');
    this.update();
    return this._div;
};

info.update = function (props) {
    if(props){
        // console.log(props);
        // this._div.innerHTML = '<h4>Confirmed cases</h4><b>' + props["NAME_1"] + ": "+statewise[props["NAME_1"]][1]+"</b>";
        this._div.innerHTML = '<h4>'+props["NAME_1"]+'</h4>'+
        '<pre>Confirmed: '+statewise[props["NAME_1"]][1]+
        '<br>Recovered: '+statewise[props["NAME_1"]][2]+
        '<br>Deaths   : '+statewise[props["NAME_1"]][3]+
        '<br>Active   : '+statewise[props["NAME_1"]][4]+"</pre>";
    }

};

info.addTo(map);

function style(feature) {
    // console.log(feature.properties["NAME_1"]);
    // console.log(statewise[feature.properties["NAME_1"]]);
    var n = 0
    if(statewise[feature.properties["NAME_1"]]){
        // console.log(statewise[feature.properties["NAME_1"]][1]);
        n = statewise[feature.properties["NAME_1"]][1];
    }

    return {
        weight: 1,
        opacity: 1,
        color: "#bfbfbf",
        // dashArray: '3',
        fillOpacity: (n>0)*0.05 + (n/maxConfirmed)*0.9,
        // fillColor: "#000000"
        fillColor: "red"
    };
}

function highlightFeature(e) {
    geojson.resetStyle();
    info.update();

    var layer = e.target;

    layer.setStyle({
        weight: 1,
        color: '#000000',
        dashArray: '',
        // fillOpacity: 0.7
    });

    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }

    info.update(layer.feature.properties);
}

var geojson;

function resetHighlight(e) {
    geojson.resetStyle(e.target);
    info.update();
}

function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
}

function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: highlightFeature
    });
}

geojson = L.geoJson(statesData, {
    style: style,
    onEachFeature: onEachFeature
}).addTo(map);
}

function getLocalTime(timestamp){
    try {
        // Assuming that the timestamp at hand is in IST, and is of the format
        // "March 17, 2020 at 10:11 pm", though the linient parser can handle sane versions of dates
        let localTime = new Date(timestamp.replace('at ','') + ' GMT+530');
        return moment(+localTime).from();
    } catch(e){
        return timestamp;
    }
}
