var dragVal = {};

var shell = nodeRequire('electron').shell;
try {
	var sqlite3 = nodeRequire('sqlite3').verbose();
} catch (e) { 
	console.log(e);
	var sqlite3 = nodeRequire('./resources/app.asar/node_modules/sqlite3').verbose();
}
//open links externally by default
$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault();
    shell.openExternal(this.href);
});



const ipc = nodeRequire('electron').ipcRenderer;

function generateReport() {
  ipc.send('print-to-pdf');
}

const electron = nodeRequire('electron');
const app = electron.app;
const path = nodeRequire('path');
const fs = nodeRequire('fs');

// fs.readdirSync('.').forEach(file => {
//   console.log(file);
// })

let dbPath;

//console.log(path.join(__dirname, '/hwbi_app/hwbi_dbOLD2.sqlite3'));
//console.log(path.join(__dirname, '/resources/app/hwbi_app/hwbi_dbOLD2.sqlite3'));
//console.log(fs.existsSync(path.join(__dirname, '/hwbi_app/hwbi_dbOLD2.sqlite3')));
//console.log(fs.existsSync(path.join(__dirname, '/resources/app/hwbi_app/hwbi_dbOLD2.sqlite3')));
//console.log(fs.existsSync(path.join(__dirname, '/resources/app.asar/hwbi_app/hwbi_dbOLD2.sqlite3')));

if (fs.existsSync(path.join(__dirname, '/hwbi_app/DISC.db'))) {
  dbPath = path.join(__dirname, "/hwbi_app/DISC.db");
} else if (fs.existsSync(path.join(__dirname, '/resources/app/hwbi_app/DISC.db'))) {
  dbPath = path.join(__dirname, "/resources/app/hwbi_app/DISC.db");
} else {
  dbPath = 'resources\app.asar\hwbi_app\DISC.db';
}

var db = new sqlite3.Database(dbPath);

function get_county_indicator_data (state = "", county = ""){
  if (state === "" || county === "") {
    return [];
  }
  var indicators = [];  

  var stmt = dbOLD2.prepare("SELECT Indicators.indicator, CountyIndicatorScores.score, CountyIndicatorScores.countyFIPS, Counties.county, Counties.stateID " +
    "FROM CountyIndicatorScores " +
    "INNER JOIN Counties ON CountyIndicatorScores.countyFIPS == Counties.county_FIPS " +
    "INNER JOIN Indicators ON CountyIndicatorScores.indicatorID == Indicators.indicatorID " +
    "WHERE Counties.county ==? AND Counties.stateID ==?");

  stmt.bind([county, state]);

  while (stmt.step()) {
    var row = stmt.get();
    var indicator = {};
    indicator.county = row[3];
    indicator.indicator = row[0];
    indicator.score = row[1];
    indicator.stateID = row[4];
    indicators.push(indicator);
  }
  stmt.free();
  return indicators;
}

function setScoreData(state, county, valueType) {
  document.getElementById('score_indicator_span').style.transform = "rotate(0deg) skew(45deg, -45deg)";
  
  $('#location').html("Snapshot results for:<br>" + county + " County, " + state); // Set location info
  $('#reportlocation').html("Report for " + county + " County, " + state);

   /* $('#wellbeing-score-location').html("Nation: " + data.outputs.nationhwbi.toFixed(1) + ", State: " +
       data.outputs.statehwbi.toFixed(1)); */

  var HWBI_score = round(dataStructure.METRIC_GROUP["HWBI"][valueType] * 100, 1); // Set location score
  $('#wellbeing-score').html(HWBI_score);

  document.getElementById('score_indicator_span').style.transform = "rotate(" + Math.round(HWBI_score * 90 / 50) + "deg) skew(45deg, -45deg)"; // set the graphic
  $('#report-wellbeing-score').html(HWBI_score);

  function slugify(string) {
    return string.replace(/ /g, '-').replace(/[^0-9a-z-_]/gi, '').toLowerCase().trim();
  }

  for (var domain in dataStructure.DOMAIN) { // Set Domain scores
    var slugifiedDomain = slugify(domain);
    var score = round(dataStructure.DOMAIN[domain][valueType] * 100, 1);
    $('#' + slugifiedDomain + '_score, #' + slugifiedDomain + '_modal_score').html(score);
    $('#' + slugifiedDomain + '_score_bar').attr('data-percent', score + "%");
    // $('#nature_location').html("[Nation: " + round(data.outputs.domains[0].nationScore, 1) +
    //     ", State: " + round(data.outputs.domains[0].stateScore, 1) + "]");
    $('#' + slugifiedDomain + '_score_summary').html(score);
  }

  for (var indicator in dataStructure.INDICATOR) { // Set indicator scores
    var slugifiedIndicator = slugify(indicator);
    var score = round(dataStructure.INDICATOR[indicator][valueType] * 100, 1);
    $('#' + slugifiedIndicator + "_value").html(score);
  }
}

function getScoreData() {
  var location_data = locationValue;
  if (location_data === "{}") {
      var locationCookie = getCookie("EPAHWBIDISC");
      if (locationCookie !== "") {
          location_data = locationCookie;
      }
      else {
        return "";
      }
  }
  var location = JSON.parse(location_data);
  
  getMetricsForCounty(location.state_abbr, location.county);

  locationValue = JSON.stringify(location);
  
  show('mainpage', 'homepage');
 
  $('#community-snapshot-tab-link').trigger("click");
  
  //setCompareData(data, 0);
  //displayCompareData(JSON.parse(sessionStorage.getItem("compareCommunities")).length);
  
  $('#customize_location').html(location.county + " County, " + location.state);
  
  //hwbi_disc_data = JSON.parse(data);

  setCookie('EPAHWBIDISC', location_data, 0.5);
}

/**
 * Change the relative importance weight of a domain
 * @listens change
 */
$('.rankinglist input').on("change", function() {
  var location = JSON.parse(locationValue);
  var $this = $(this)
  var label = $this.parent().html().substring(0, $this.parent().html().indexOf('<'));

  //useRIVWeights();
  dataStructure.DOMAIN[label].weight = +$this.val();

  updateAllWeightedAvgValues('METRIC_GROUP', 'adjusted_val'); // calculate the metric group scores by averaging each metric group's child domains
  setScoreData(location.state_abbr, location.county, "adjusted_val"); // set the domain scores
  runAsterPlot();
});

/**
 * Change the HWBI metric values, update the indicators, domains, and the domains on the snapshot page snapshot
 * @listens change
 */
$('.customize-metrics').on('change', function() { // customize metric listeners
  var ele = $(this);
  var val = +ele.val();
  var loc = JSON.parse(locationValue);
  var state = loc.state_abbr;
  var county = loc.county;
  var metric = dataStructure.METRIC_VAR[ele.attr('id').toUpperCase()];
  
  metric.adjusted_val = val;

  updateAllAvgValues('INDICATOR', 'adjusted_val'); // calculate the indicator scores by averaging each indicator's child metrics
  updateAllAvgValues('DOMAIN', 'adjusted_val'); // calculate the domain scores by averaging each domain's child indicators
  updateAllWeightedAvgValues('METRIC_GROUP', 'adjusted_val'); // calculate the metric group scores by averaging each metric group's child domains
  setScoreData(state, county, "adjusted_val"); // set the domain scores
  loadSkillbar(); // update the colored bars on the snapshot page
  runAsterPlot();

  // for (var i = 0; i < dragVal.services.length; i++) {
  //   if (dragVal.services[i].name === ele.attr('id')) {
  //     dragVal.services[i].score = +val;
  //   }
  // }
  //updateAsterPlot(hwbi_run(dragVal.services, hwbi_disc_data.outputs.domains).domains);
  //useRIVWeights();
});

$('.thumb').on('input', function() {
  var $ele = $(this);
  var val = (+$ele.val() * (+$ele.attr("data-max") - +$ele.attr("data-min")) + +$ele.attr("data-min"));
  $ele.prev().html("<span> " + round(val, 3) + "</span>");
});

function getScoreDataAJAXCall(location){
  var data = {};
  //data.outputs = getIndicatorsForCounty(location.state_abbr, location.county);

  hwbi_indicator_data = formatIndicatorData(setIndicatorData(JSON.stringify(data)));
  console.log(data)
  data = formatDomainData(data);
  console.log(data)
  // build inputs
  var inputs = [];
  var meta_state = {
    'name': 'state',
    'value': location.state,
    'description': 'US State'
  };
  var meta_county = {
    'name': 'county',
    'value': location.county,
    'description': 'County'
  };
  inputs.push(meta_state);
  inputs.push(meta_county);
  data.inputs = inputs;  
  data.outputs.services = get_baseline_scores(location.state, location.county);

  return data;
}

function get_baseline_scores(state = "", county = "") {
  if (state === "" || county === "") {
    return [];
  }
  var services = [];
  // Old Database
  var stmt = dbOLD.prepare("Select SSB.county_FIPS, CO.stateID, ST.[State], CO.county, SSB.serviceID, SVC.serviceName, SVC.serviceTypeName, SSB.score, SVC.description, SVT.serviceType, SVC.name " +
     "From ServiceScores_Baseline SSB, Counties CO, [Services] SVC, States ST, ServiceTypes SVT " +
     "Where SSB.county_FIPS=CO.county_FIPS and UPPER(ST.state)=? and UPPER(CO.county)=? and SSB.serviceID=SVC.serviceID and CO.stateID=ST.stateID and SVC.serviceTypeID=SVT.serviceTypeID");
  stmt.bind([state.toUpperCase(), county.toUpperCase()]);
  
  while (stmt.step()) {
    var row = stmt.get();
    var service = {};
    service.serviceID = row[4];
    service.name = row[10];
    service.serviceTypeName = row[6];
    service.description = row[5];
    service.score = row[7];
    services.push(service);
  }
  stmt.free();
  return services;
}

function get_state_details(state = ''){
  if (state === '') {
    return [];
  }
  var scores = [];
  var stmt = dbOLD2.prepare("Select * from States where state =?");
  stmt.bind([state]);
  while (stmt.step()) {
    var row = stmt.get()
    scores = row;
  }
  stmt.free();
  return scores;
}

function get_domains() {
    var domains = []
    var stmt = dbOLD.prepare("Select * from Domains");
    while (stmt.step()) {
      var row = stmt.get()
      domains.push(row);
    }
    stmt.free();
    return domains;
}

function hwbi_run(services, domains){
  var outputs = {};
  var scaledScores = {};
  for (var i = 0; i < services.length; i++) {
    scaledScores[services[i].name.toLowerCase()] = services[i].score / 100;
  }
  var calculatedScores = {};
  calculatedScores.connectiontonature = (2.431227
    + (0.577159 * scaledScores.communityandfaith)
    + (-1.755944 * scaledScores.activism)
    + (-0.370377 * scaledScores.redistribution)
    + (0.465541 * scaledScores.consumption)
    + (-0.111739 * scaledScores.healthcare)
    + (-2.388524 * scaledScores.emergencypreparedness)
    + (-0.524012 * scaledScores.greenspace)
    + (0.05051 * scaledScores.waterquality)
    + (-1.934059 * scaledScores.labor)
    + (0.211648 * scaledScores.education)
    + (-1.998989 * scaledScores.communityandfaith * scaledScores.emergencypreparedness)
    + (2.103267 * scaledScores.activism * scaledScores.emergencypreparedness)
    + (3.222831 * scaledScores.emergencypreparedness * scaledScores.labor)
    ) * 100;

    calculatedScores.culturalfulfillment = (-0.22391
    + (2.429595 * scaledScores.communityandfaith)
    + (-0.100712 * scaledScores.airquality)
    + (-0.131353 * scaledScores.waterquantity)
    + (0.084694 * scaledScores.emergencypreparedness)
    + (0.191835 * scaledScores.education)
    + (0.09992 * scaledScores.innovation)
    + (1.280481 * scaledScores.communication)
    + (-0.097182 * scaledScores.production)
    + (-4.405586 * scaledScores.communityandfaith * scaledScores.communication)
    + (0.23472 * scaledScores.communityandfaith * scaledScores.airquality)
    ) * 100;

    calculatedScores.education = (0.392837
    + (0.350783 * scaledScores.familyservices)
    + (0.463786 * scaledScores.communityandfaith)
    + (-0.48866 * scaledScores.production)
    + (0.078233 * scaledScores.publicworks)
    + (-0.441537 * scaledScores.justice)
    + (0.574752 * scaledScores.activism)
    + (-0.37372 * scaledScores.consumption)
    + (0.390576 * scaledScores.redistribution * scaledScores.greenspace)
    ) * 100;

    calculatedScores.health = (0.231086
    + (0.072714 * scaledScores.familyservices)
    + (0.194939 * scaledScores.communication)
    + (0.097708 * scaledScores.labor)
    + (0.020422 * scaledScores.waterquantity)
    + (0.095983 * scaledScores.innovation)
    + (0.04914 * scaledScores.emergencypreparedness)
    + (0.52497 * scaledScores.communityandfaith)
    + (0.149127 * scaledScores.justice)
    + (0.050258 * scaledScores.activism * scaledScores.education)
    + (-0.866259 * scaledScores.communityandfaith * scaledScores.justice)
    ) * 100;

    calculatedScores.leisuretime = (0.506212
    + (-0.340958 * scaledScores.employment)
    + (-0.719677 * scaledScores.waterquantity)
    + (-0.39237 * scaledScores.consumption)
    + (0.682084 * scaledScores.foodfiberandfuel)
    + (-0.053742 * scaledScores.waterquality)
    + (0.138196 * scaledScores.greenspace)
    + (-0.544925 * scaledScores.education)
    + (0.577271 * scaledScores.publicworks)
    + (-0.217388 * scaledScores.communityandfaith)
    + (0.934746 * scaledScores.activism)
    + (1.599972 * scaledScores.waterquantity * scaledScores.education)
    + (0.206249 * scaledScores.finance * scaledScores.communication)
    + (-1.29474 * scaledScores.publicworks * scaledScores.activism)
    + (-0.171528 * scaledScores.education * scaledScores.innovation)
    ) * 100;

    calculatedScores.livingstandards = (0.275027
    + (0.092259 * scaledScores.employment)
    + (-0.146247 * scaledScores.publicworks)
    + (0.134713 * scaledScores.labor)
    + (0.367559 * scaledScores.activism)
    + (-0.259411 * scaledScores.finance)
    + (-0.17859 * scaledScores.justice)
    + (0.078427 * scaledScores.waterquantity)
    + (-0.024932 * scaledScores.capitalinvestment)
    + (0.708609 * scaledScores.publicworks * scaledScores.finance)
    + (-0.038308 * scaledScores.capitalinvestment * scaledScores.waterquality)
    + (0.177212 * scaledScores.foodfiberandfuel * scaledScores.communication)
    ) * 100;

    calculatedScores.safetyandsecurity = (0.603914
    + (0.294092 * scaledScores.communityandfaith)
    + (-0.380562 * scaledScores.waterquality)
    + (-0.385317 * scaledScores.publicworks)
    + (0.085398 * scaledScores.waterquantity)
    + (1.35322 * scaledScores.activism * scaledScores.labor)
    + (-0.304328 * scaledScores.production * scaledScores.healthcare)
    + (-1.147411 * scaledScores.labor * scaledScores.justice)
    + (0.295058 * scaledScores.production * scaledScores.foodfiberandfuel)
    + (-0.742299 * scaledScores.greenspace * scaledScores.emergencypreparedness)
    + (-0.602264 * scaledScores.activism * scaledScores.finance)
    + (0.898598 * scaledScores.justice * scaledScores.emergencypreparedness)
    + (0.574027 * scaledScores.publicworks * scaledScores.finance)
    + (0.655645 * scaledScores.waterquality * scaledScores.publicworks)
    ) * 100;

    calculatedScores.socialcohesion = (-0.810156
    + (1.07278 * scaledScores.justice)
    + (0.042486 * scaledScores.airquality)
    + (-0.382991 * scaledScores.production)
    + (1.980596 * scaledScores.communityandfaith)
    + (0.047261 * scaledScores.publicworks)
    + (1.282272 * scaledScores.redistribution)
    + (0.100406 * scaledScores.capitalinvestment)
    + (0.152944 * scaledScores.familyservices)
    + (0.120707 * scaledScores.labor)
    + (1.291316 * scaledScores.greenspace)
    + (-0.148073 * scaledScores.consumption)
    + (-3.59425 * scaledScores.communityandfaith * scaledScores.redistribution)
    + (-2.048002 * scaledScores.justice * scaledScores.greenspace)
    + (-0.036457 * scaledScores.employment * scaledScores.waterquality)
    ) * 100;

    var domains = [];
    var db_domains = get_domains();
    var hwbi = 0;
    total_wt = 0;
    for (var i = 0; i < db_domains.length; i++) {
      var domainObject = {};
      var domain = db_domains[i][2].toLowerCase();
      domainObject.domainID = db_domains[i][0];
      domainObject.domainName = "";
      domainObject.name = db_domains[i][2];
      domainObject.description = db_domains[i][1];
      domainObject.score = calculatedScores[domain];
      domainObject.weight = 1;
      domains.push(domainObject);

      hwbi += domainObject.score * domainObject.weight;
      total_wt += domainObject.weight;
    }

    outputs.domains = domains;
    outputs.hwbi = hwbi / total_wt;

  return outputs;
}

function getComparisonData() {
  var communityNumber = +$(this).attr('data-community'); // get the community number
  var place = compareSearchBox[communityNumber].getPlace();
  var county = place.address_components[1]['long_name'].replace(" County", "");
  var state = place.address_components[2]['long_name'];
  var state_abbr = place.address_components[2]['short_name'];
  var location = {};
  location["county"] = county;
  location["state"] = state;
  location["state_abbr"] = state_abbr;

  $('.compare-search-button').eq(communityNumber).addClass('searching');
  $('.compare-search-error').hide();

  data = JSON.stringify(getScoreDataAJAXCall(location));
  if (setCompareData(data, communityNumber) !== "dupe") {
    $('.add-community-search').eq(communityNumber).hide();
  } else {
      $('.compare-search-error').eq(communityNumber).html('This community has already been added. Please try another location.').show();
  }
  displayCompareData();
  $('.compare-search-button').eq(communityNumber).removeClass('searching');
}

function getStateIndicators(state = "") {
  if (state === "") {
    return {};
  }

  var stmt = dbOLD2.prepare("SELECT Indicators.indicator, CountyIndicatorScores.score, Counties.stateID " +
    "FROM CountyIndicatorScores " +
    "INNER JOIN Counties ON CountyIndicatorScores.countyFIPS == Counties.county_FIPS " +
    "INNER JOIN Indicators ON CountyIndicatorScores.indicatorID == Indicators.indicatorID " +
    "WHERE Counties.stateID ==?;")

  stmt.bind([state]);

  while (stmt.step()) {
    var row = stmt.get();
    var indicator = {};
    indicator.indicator = row[0];
    indicator.score = row[1];
    indicator.stateID = row[2];
    indicators.push(indicator);
  }
  stmt.free();
  return indicators;
}

function getIndicatorsForCounty(state = "", county = ""){
  if (state === "" || county === "") {
    return {};
  }
  var indicators = [];

  var stmt = dbOLD2.prepare("SELECT Indicators.indicator, CountyIndicatorScores.score, CountyIndicatorScores.countyFIPS, Counties.county, Counties.stateID " +
    "FROM CountyIndicatorScores " +
    "INNER JOIN Counties ON CountyIndicatorScores.countyFIPS == Counties.county_FIPS " +
    "INNER JOIN Indicators ON CountyIndicatorScores.indicatorID == Indicators.indicatorID " +
    "WHERE Counties.county ==? AND Counties.stateID ==?")

  stmt.bind([county, state]);

  while (stmt.step()) {
    var row = stmt.get();
    var indicator = {};
    indicator.county = row[3];
    indicator.indicator = row[0];
    indicator.score = row[1];
    indicator.stateID = row[4];
    indicators.push(indicator);
  }
  stmt.free();
  return indicators;
}

function getMetricsForCounty(state = "", county = "") {
  var sql = "SELECT  MetricVariables.METRIC_VAR, " +
                    "MetricVariables.METRIC_DESCRIPTION, " +
                    "MetricScores.SCORE, " +
                    "MetricScores.FIPS, " +
                    "Counties.COUNTY_NAME, " +
                    "Counties.STATE_CODE, " +
                    "Domains.DOMAIN, " +
                    "Indicators.INDICATOR, " +
                    "MetricGroups.METRIC_GROUP, " +
                    "MetricScores.MINVAL, " +
                    "MetricScores.MAXVAL, " +
                    "MetricScores.POS_NEG_METRIC, " +
                    "MetricVariables.SHORT_DESCRIPTION " +
  "FROM MetricScores " +
  "INNER JOIN Counties ON MetricScores.FIPS == Counties.FIPS " +
  "INNER JOIN MetricVariables ON MetricScores.METRIC_VAR_ID == MetricVariables.ID " +
  "INNER JOIN MetricGroups ON MetricVariables.METRIC_GROUP_ID == MetricGroups.ID  " +
  "INNER JOIN Domains ON MetricVariables.DOMAIN_ID == Domains.ID " +
  "INNER JOIN Indicators ON MetricVariables.INDICATOR_ID == Indicators.ID " +
  "WHERE Counties.COUNTY_NAME ==? AND Counties.STATE_CODE ==?";

  db.all(sql, [county, state], (err, rows) => {
    if (err) {
      throw err;
    }
    rows.forEach((row) => {
      var $ele = $('#' + row.METRIC_VAR.toLowerCase());
      var rawVal = (row.SCORE * (row.MAXVAL - row.MINVAL) + row.MINVAL);
      $ele.val(row.SCORE); // set the metric scores
      $ele.prev().html("<span> " + round(rawVal, 3) + "</span>");
      dataStructure.METRIC_VAR[row.METRIC_VAR].original_val = row.SCORE; // add the metric score to the data structure
      dataStructure.METRIC_VAR[row.METRIC_VAR].adjusted_val = row.SCORE; // add the metric score to the data structure
      dataStructure.METRIC_VAR[row.METRIC_VAR].scenario_val = row.SCORE; // add the metric score to the data structure
    });
   
    setAllInitialAvgValues('INDICATOR'); // calculate the indicator scores by averaging each indicator's child metrics
    setAllInitialAvgValues('DOMAIN'); // calculate the domain scores by averaging each domain's child indicators
    setAllInitialWeightedAvgValues('METRIC_GROUP'); // calculate the metric group scores by averaging each metric group's child domains

    setScoreData(state, county, "original_val"); // set the domain scores
    loadSkillbar(); // update the colored bars on the snapshot page
    runAsterPlot(); //draw aster plot
  });
}

var dataStructure = {
  METRIC_GROUP: {},
  DOMAIN: {},
  INDICATOR: {},
  METRIC_VAR: {}
};

function createDataStructure() {
  sql = "SELECT MetricGroups.METRIC_GROUP as METRIC_GROUP, Domains.DOMAIN AS DOMAIN, Indicators.INDICATOR as INDICATOR, METRIC_VAR " +
  "FROM MetricVariables " +
  "INNER JOIN MetricGroups ON MetricVariables.METRIC_GROUP_ID == MetricGroups.ID " +
  "INNER JOIN Domains ON MetricVariables.DOMAIN_ID == Domains.ID " +
  "INNER JOIN Indicators ON MetricVariables.INDICATOR_ID == Indicators.ID;";

  db.all(sql, [], (err, rows) => {
    if (err) {
      throw err;
    }
    rows.forEach((row) => {

      if (!dataStructure.METRIC_GROUP.hasOwnProperty(row.METRIC_GROUP)) {
        dataStructure.METRIC_GROUP[row.METRIC_GROUP] = new Node(row.METRIC_GROUP, [], 0, 0, 0, null, "METRIC_GROUP");
      }

      if (!dataStructure.DOMAIN.hasOwnProperty(row.DOMAIN)) {
        dataStructure.DOMAIN[row.DOMAIN] = new Node(row.DOMAIN, [], 0, 0, 0, dataStructure.METRIC_GROUP[row.METRIC_GROUP], "DOMAIN");
      } else if (dataStructure.DOMAIN[row.DOMAIN].parent.name !== row.METRIC_GROUP) {
        console.log("This domain exists already... " + row.DOMAIN + " BUT " + dataStructure.DOMAIN[row.DOMAIN].parent.name + " != " + row.METRIC_GROUP)
        //dataStructure.INDICATOR[row.INDICATOR] = new Node(row.INDICATOR, [], 0, 0, dataStructure.DOMAIN[row.DOMAIN], "INDICATOR");
      }

      if (!dataStructure.INDICATOR.hasOwnProperty(row.DOMAIN + '_' + row.INDICATOR)) {
        dataStructure.INDICATOR[row.DOMAIN + '_' + row.INDICATOR] = new Node(row.DOMAIN + '_' + row.INDICATOR, [], 0, 0, 0, dataStructure.DOMAIN[row.DOMAIN], "INDICATOR");
      } else if (dataStructure.INDICATOR[row.DOMAIN + '_' + row.INDICATOR].parent.name !== row.DOMAIN) {
        console.log("This indicator exists already... " + row.DOMAIN + '_' + row.INDICATOR + " BUT " + dataStructure.INDICATOR[row.DOMAIN + '_' + row.INDICATOR].parent.name + " != " + row.DOMAIN)
        dataStructure.INDICATOR[row.DOMAIN + '_' + row.INDICATOR] = new Node(row.DOMAIN + '_' + row.INDICATOR, [], 0, 0, 0,dataStructure.DOMAIN[row.DOMAIN], "INDICATOR");
      }

      if (!dataStructure.METRIC_VAR.hasOwnProperty(row.METRIC_VAR)) {
        dataStructure.METRIC_VAR[row.METRIC_VAR] = new Node(row.METRIC_VAR, [], 0, 0, 0, dataStructure.INDICATOR[row.DOMAIN + '_' + row.INDICATOR], "METRIC_VAR");
      }

      if (dataStructure.METRIC_GROUP[row.METRIC_GROUP].children.indexOf(dataStructure.DOMAIN[row.DOMAIN]) < 0) {
        dataStructure.METRIC_GROUP[row.METRIC_GROUP].children.push(dataStructure.DOMAIN[row.DOMAIN]);
      }
      if (dataStructure.DOMAIN[row.DOMAIN].children.indexOf(dataStructure.INDICATOR[row.DOMAIN + '_' + row.INDICATOR]) < 0) {
        dataStructure.DOMAIN[row.DOMAIN].children.push(dataStructure.INDICATOR[row.DOMAIN + '_' + row.INDICATOR]);
      }
      if (dataStructure.INDICATOR[row.DOMAIN + '_' + row.INDICATOR].children.indexOf(dataStructure.METRIC_VAR[row.METRIC_VAR]) < 0) {
        dataStructure.INDICATOR[row.DOMAIN + '_' + row.INDICATOR].children.push(dataStructure.METRIC_VAR[row.METRIC_VAR]);
      }
    });
  });
}

function Node(name, children, original_val, adjusted_val, scenario_val, parent, type) {
  this.name = name;
  this.children = children;
  this.original_val = original_val;
  this.adjusted_val = adjusted_val;
  this.scenario_val = scenario_val;
  this.parent = parent;
  this.type = type;
  if (type === "DOMAIN") {
    this.weight = 1;
  }
}

// a('INDICATOR', 'original_val'); // calculate the indicator scores by averaging each indicator's child metrics
// set the 'value' to the average of the children Node's 'value' for the specified 'thing'
function updateAllAvgValues(thing, value) {
	for (var indicator in dataStructure[thing]) {
    var sum = function (items, prop) {
      return items.reduce( function(a, b) {
        return a + b[prop];
      }, 0);
    };
    var avg = sum(dataStructure[thing][indicator].children, value) / dataStructure[thing][indicator].children.length;
		dataStructure[thing][indicator][value] = avg;
  }
}

function updateAllWeightedAvgValues(thing, value) {
	for (var indicator in dataStructure[thing]) {
    var sum = function (items, prop) {
      return items.reduce( function(a, b) {
        return a + b[prop];
      }, 0);
    };
    var weightedSum = function (items, prop) {
      return items.reduce( function(a, b) {
        return a + b[prop] * b.weight;
      }, 0);
    };
    var avg = weightedSum(dataStructure[thing][indicator].children, value) / sum(dataStructure[thing][indicator].children, "weight");
		dataStructure[thing][indicator][value] = avg;
  }
}

function setAllInitialAvgValues(thing) {
	for (var indicator in dataStructure[thing]) {
    var sum = function (items, prop) {
      return items.reduce( function(a, b) {
        return a + b[prop];
      }, 0);
    };
    var avg = sum(dataStructure[thing][indicator].children, "original_val") / dataStructure[thing][indicator].children.length;
    dataStructure[thing][indicator]["original_val"] = avg;
    dataStructure[thing][indicator]["adjusted_val"] = avg;
    dataStructure[thing][indicator]["scenario_val"] = avg;
  }
}

function setAllInitialWeightedAvgValues(thing) {
	for (var indicator in dataStructure[thing]) {
    var sum = function (items, prop) {
      return items.reduce( function(a, b) {
        return a + b[prop];
      }, 0);
    };
    var weightedSum = function (items, prop) {
      return items.reduce( function(a, b) {
        return a + b[prop] * b.weight;
      }, 0);
    };
    var avg = weightedSum(dataStructure[thing][indicator].children, "original_val") / sum(dataStructure[thing][indicator].children, "weight");
    dataStructure[thing][indicator]["original_val"] = avg;
    dataStructure[thing][indicator]["adjusted_val"] = avg;
    dataStructure[thing][indicator]["scenario_val"] = avg;
  }
}

function runAsterPlot() {
  var asterData = [];
  for (var domain in dataStructure.DOMAIN) {
    if (dataStructure.DOMAIN[domain].parent.name == "HWBI") {
      asterData.push({
          description: domain,
          weight: dataStructure.DOMAIN[domain].weight,
          score: dataStructure.DOMAIN[domain].adjusted_val * 100
      });
    }
  }

  if (drawn === false) {
    drawAsterPlot(asterData);
  } else {
    updateAsterPlot(asterData);
  }
}

createDataStructure();