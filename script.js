var all_data = [];
var statewise = {};
var maxConfirmed = 0;
var lastUpdated = "";

var confirmed_delta = 0;
var deaths_delta = 0;
var recovered_delta = 0;
var states_delta = 0;
let total = {};
var key_values = 0;
var numStatesInfected = 0;
var stateWiseTableData;
var sort_field = 0;
var sort_order;

var table_columns = [
    {
        key: "state",
        display_name: "State"
    },
    {
        key: "confirmed",
        display_name: "Confirmed"
    },
    {
        key: "recovered",
        display_name: "Recovered"
    },
    {
        key: "deaths",
        display_name: "Deaths"
    },
    {
        key: "active",
        display_name: "Active"
    }
];

$.getJSON("https://api.covid19india.org/data.json",
function(result) {
    stateWiseTableData = result.statewise;
    key_values = result.key_values[0];
    stateWiseTableData.forEach((stateData) => {
        if(stateData.state === "Total") {
            total = stateData;
        } else {
            if(parseInt(stateData.confirmed) > 0) {
                numStatesInfected++;
            }
            maxConfirmed = stateData.confirmed > maxConfirmed ? stateData.confirmed : maxConfirmed;
            statewise[stateData.state] = stateData;
        }
    });

    tablehtml = constructTable(stateWiseTableData);
    
    $("div#states-value").html(numStatesInfected);
    $("div#confvalue").html(total.confirmed);
    $("div#deathsvalue").html(total.deaths);
    $("div#recoveredvalue").html(total.recovered);
    $("strong#last-updated").html(key_values.lastupdatedtime);

    if(key_values.confirmeddelta)$("div#confirmed_delta").html("( +"+key_values.confirmeddelta+")");
    if(key_values.deceaseddelta) $("div#deaths_delta").html("( +"+key_values.deceaseddelta+")");
    if(key_values.recovereddelta)$("div#recovered_delta").html("( +"+key_values.recovereddelta+")");
    if(key_values.statesdelta)$("div#states_delta").html("( +"+key_values.statesdelta+")");

    constructTweetButton();

    initMapStuff();

});


function constructTweetButton() {
    let current_date = new Date().toLocaleString('en-IN');
    let active_delta = key_values.confirmeddelta - key_values.recovereddelta
    let active_delta_status = active_delta >= 0? "increased" : "decreased";
    const tweet_content = `COVID-19 India : 📊 as of ${current_date} IST
Total Confirmed : ${total.confirmed}
Total Recovered : ${total.recovered}
Total Deceased. : ${total.deaths}

Number of active cases ${active_delta_status} by ${Math.abs(active_delta)} today

Follow @covid19indiaorg

#COVI19India #SocialDistancing
More @`

    jQuery("#twitter_share").attr("data-text", tweet_content);
    jQuery("#twitter_share").addClass("twitter-share-button");
    twttr.widgets.load();
}

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
``
    L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1Ijoic2hhZmVlcS1ldCIsImEiOiJjazgwZ2Jta20wZ2lxM2tsbjBmbnpsNGQyIn0.JyWxwnlx0oDopQ8JWM8YZA', {
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
        this._div.innerHTML = '<h4>'+props["NAME_1"]+'</h4>'+
        '<pre>Confirmed: '+statewise[props["NAME_1"]].confirmed+
        '<br>Recovered: '+statewise[props["NAME_1"]].recovered+
        '<br>Deaths   : '+statewise[props["NAME_1"]].deaths+
        '<br>Active   : '+statewise[props["NAME_1"]].active+"</pre>";
    }

};

info.addTo(map);

function style(feature) {
    var n = 0
    if(statewise[feature.properties["NAME_1"]]){
        n = statewise[feature.properties["NAME_1"]].confirmed;
    }

    return {
        weight: 1,
        opacity: 1,
        color: "#bfbfbf",
        fillOpacity: (n>0)*0.05 + (n/maxConfirmed)*0.9,
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

function constructTable(stateWiseTableData) {
    var tablehtml = "<thead>";

    /* Construct Table Header */
    tablehtml += "<tr>";
    table_columns.forEach(function(column, i) {
        tablehtml += "<th><a href='' col_id='" + i + "' onclick='sort(this,event)'>" + column.display_name + "</a></th>";
    });
    tablehtml += "</tr></thead><tbody>";

    /* Construct Table Body */
    stateWiseTableData.forEach((stateData, index) => {
        if(stateData.state === "Total"){
            return;
        }

        tablehtml += "<tr>";
        table_columns.forEach(column => {
            if(parseInt(stateData.confirmed) > 0) {
                tablehtml += "<td>" + stateData[column.key] + "</td>";
            }
        })
        tablehtml += "</tr>";

    });

    /* Adding Total Row at end */
    tablehtml += '<tr class="totals">';
    table_columns.forEach(column => {
        tablehtml += "<td>" + total[column.key] + "</td>";
    });
    tablehtml += "</tr></tbody";

    $("table#prefectures-table").html(tablehtml);
    return tablehtml;
}

function sort(column, event) {
    event.stopPropagation();
    event.preventDefault();

    const col_id = $(column).attr("col_id");

    var total_ele = stateWiseTableData.splice(0, 1);
    
    sort_order = col_id == sort_field? sort_order : undefined;

    if(!sort_order) {
        sort_order = col_id == 0? "A" : "D"
    }

    const columnKey = table_columns[col_id].key;

    stateWiseTableData.sort((StateData1, StateData2) => {
        let value1 = StateData1[columnKey];
        let value2 = StateData2[columnKey];
        
        if(columnKey != "state") {
            value1 = parseInt(value1);
            value2 = parseInt(value2);
        }

        if(sort_order == "D"){
            return value1 > value2? -1 : 1;
        } else {
            return value1 > value2? 1 : -1;
        }
    })

    stateWiseTableData.unshift(total_ele[0]);

    sort_field = col_id;

    sort_order = sort_order == "A"? "D" : "A";

    constructTable(stateWiseTableData);
}
