const electron = nodeRequire('electron');
const { app, ipcRenderer, shell } = electron;
const { dialog } = electron.remote

const path = nodeRequire('path');
const fs = nodeRequire('fs');

try {
	var sqlite3 = nodeRequire('sqlite3').verbose();
} catch (e) { 
  console.log(e);
  try {
    var sqlite3 = nodeRequire(path.join(process.resourcesPath, '/app.asar/node_modules/sqlite3')).verbose();
  } catch (e) { 
    console.log(e);
  }
}

try {
  d3.tip = nodeRequire('d3-tip');
} catch (e) { 
  
  try {
    d3.tip = nodeRequire(path.join(process.resourcesPath, '/app.asar/node_modules/d3-tip'));
  } catch (e) { 
    console.log(e);
  }
}

let dataStructure;

$(function() {
  dataStructure = {
    METRIC_GROUP: {},
    HWBI_DOMAIN: {},
    SERVICE_DOMAIN: {},
    HWBI_INDICATOR: {},
    SERVICE_INDICATOR: {},
    HWBI_METRIC: {},
    SERVICE_METRIC: {}
  };
  createDataStructure(dataStructure);
});

//open links externally by default
$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault();
    shell.openExternal(this.href);
});

function generateReport() {
    let chkbx = $('.resources-checkbox');
    let a;

    for (a = 0; a < chkbx.length; a++) {
      if($(chkbx[a]).is(':checked') && !$(chkbx[a]).parent().parent().parent().prev('.accordion-metrics').hasClass('active-metric')) {
        /* $('input:checkbox').closest('button').addClass('active-metric');
        $('input:checkbox').closest('div.metric-accordion-panel').css('display','block'); */
        $(chkbx[a]).parent().parent().parent().prev('.accordion-metrics').trigger('click');
      }
    }
  ipcRenderer.send('print-to-pdf');
}

ipcRenderer.on('toggleSearch', function() {

  $('#statecounty').toggle();
  $('.autocomplete-container').toggle();

  $('#mainpage-statecounty').toggle();
  $('.search').toggle();
});

function generateSnapshot() {
  var domainData = {
    HWBI_DOMAIN: {},
    Service: {},
    DISC: {},
      National_DOMAIN: {},
      State_DOMAIN: {},
    National_DISC: {},
      State_DISC: {},
    location: ''
  };

  for (var domain in dataStructure.HWBI_DOMAIN) {
    domainName = dataStructure.HWBI_DOMAIN[domain].name;
    domainData.HWBI_DOMAIN[domainName] = {
        score: dataStructure.HWBI_DOMAIN[domain].custom_val,
      locationValues: $('#' + slugify(domainName) + '_location').html()
    }
  }

  for (var domain in dataStructure.METRIC_GROUP) {
    domainName = dataStructure.METRIC_GROUP[domain].name;
    if (domainName !== "HWBI") {
          domainData.Service[domainName] = {
              score: dataStructure.METRIC_GROUP[domain].custom_val
          }
      } else {
      domainData.DISC = {
              score: dataStructure.METRIC_GROUP[domain].custom_val
          }
    }
  }
  domainData.location = $('#location').html();
  domainData.locationScores = $('#wellbeing-score-location').html();
  ipcRenderer.send('snap', domainData);
}

let dbPath;

if (fs.existsSync(path.join(__dirname, '/hwbi_app/DISC.db'))) {
  dbPath = path.join(__dirname, "/hwbi_app/DISC.db");
} else if (fs.existsSync(path.join(__dirname, '/resources/app/hwbi_app/DISC.db'))) {
  dbPath = path.join(__dirname, "/resources/app/hwbi_app/DISC.db");
} else if (fs.existsSync(path.join(process.resourcesPath, '/hwbi_app/DISC.db'))) {
  dbPath = path.join(process.resourcesPath, '/hwbi_app/DISC.db');
} else {
  console.log("Database not found.")
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

  var HWBI_score = round(dataStructure.METRIC_GROUP["1"][valueType] * 100, 1); // Set location score
  $('#wellbeing-score').html(HWBI_score);
  $('.modal-disc-score span').html(HWBI_score);

  document.getElementById('score_indicator_span').style.transform = "rotate(" + Math.round(HWBI_score * 90 / 50) + "deg) skew(45deg, -45deg)"; // set the graphic
  $('#report-wellbeing-score').html(HWBI_score);

  for (var domain in dataStructure.HWBI_DOMAIN) { // Set Domain scores
    var slugifiedDomain = slugify(dataStructure.HWBI_DOMAIN[domain].name);
    var score = round(dataStructure.HWBI_DOMAIN[domain][valueType] * 100, 1);
    $('#' + slugifiedDomain + '_score, #' + slugifiedDomain + '_modal_score').html(score);
    $('#' + slugifiedDomain + '_score_bar').attr('data-percent', score + "%");
    $('#' + slugifiedDomain + '_score_summary').html(score);
  }

  for (var indicator in dataStructure.HWBI_INDICATOR) { // Set indicator scores
    var slugifiedIndicator = slugify(dataStructure.HWBI_INDICATOR[indicator].parent.name) + "_" + slugify(dataStructure.HWBI_INDICATOR[indicator].name);
    var score = round(dataStructure.HWBI_INDICATOR[indicator][valueType] * 100, 1);
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
  
  initializeRankingDonut();
  getStateDomainScores(location.state_abbr);
  getStateDISCScore(location.state_abbr);
  getMetricsForCounty(location.state_abbr, location.county);

  locationValue = JSON.stringify(location);
  show('mainpage', 'homepage');
  $('#community-snapshot-tab-link').trigger("click");
  $('#customize_location').html(location.county + " County, " + location.state);
  setCookie('EPAHWBIDISC', location_data, 0.5);
}

/**
 * Change the relative importance weight of a domain
 * @listens change
 */
$('.rankinglist input').on("input", function() {
  var location = JSON.parse(locationValue);
  var $this = $(this)
  var label = $this.attr('data-did');
  // var label = $this.attr('data-domain');

  dataStructure.HWBI_DOMAIN[label].weight = +$this.val();
  var data = [];
  for (var domain in dataStructure.HWBI_DOMAIN) {
      data.push({
          Domain: dataStructure.HWBI_DOMAIN[domain].name,
          Weight: dataStructure.HWBI_DOMAIN[domain].weight	
      });
  }
  donut.data(data);

  updateAllWeightedAvgValues('METRIC_GROUP', 'custom_val', dataStructure); // calculate the metric group scores by averaging each metric group's child domains
  setScoreData(location.state_abbr, location.county, "custom_val"); // set the domain scores
  calculateServiceHWBI();
  runAsterPlot();
});

/**
 * Change the HWBI metric values, update the indicators, domains, and the domains on the snapshot page snapshot
 * @listens change
 */
$('.customize-hwbi-metrics').on('change', function() { // customize metric listeners
  var ele = $(this);
  var val = +ele.val();
  var loc = JSON.parse(locationValue);
  var state = loc.state_abbr;
  var county = loc.county;
  var metric = dataStructure.HWBI_METRIC[ele.attr('data-var')];
  
  metric.custom_val = val;

  updateAllAvgValues('HWBI_INDICATOR', 'custom_val', dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
  updateAllAvgValues('HWBI_DOMAIN', 'custom_val', dataStructure); // calculate the domain scores by averaging each domain's child indicators

  updateAllWeightedAvgValues('METRIC_GROUP', 'custom_val', dataStructure); // calculate the metric group scores by averaging each metric group's child domains
  setScoreData(state, county, "custom_val"); // set the domain scores
  loadSkillbar(); // update the colored bars on the snapshot page
});

/**
 * Change the HWBI metric values, update the indicators, domains, and the domains on the snapshot page snapshot
 * @listens change
 */
$('.customize-service-metrics').on('change', function() { // customize metric listeners
  var ele = $(this);
  var val = +ele.val();
  var metric = dataStructure.SERVICE_METRIC[ele.attr('data-var')];
  
  metric.custom_val = val;

  updateAllAvgValues('SERVICE_INDICATOR', 'custom_val', dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
  updateAllAvgValues('SERVICE_DOMAIN', 'custom_val', dataStructure); // calculate the domain scores by averaging each domain's child indicators
  updateAllWeightedAvgValues('METRIC_GROUP', 'custom_val', dataStructure); // calculate the metric group scores by averaging each metric group's child domains
});

$('.scenario-builder-metric').on('change', function() { // customize metric listeners
  var ele = $(this);
  var val = +ele.val();
  var metric = dataStructure.SERVICE_METRIC[ele.attr('data-var')];
  
  metric.scenario_val = val;

  updateAllAvgValues('SERVICE_INDICATOR', 'scenario_val', dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
  updateAllAvgValues('SERVICE_DOMAIN', 'scenario_val', dataStructure); // calculate the domain scores by averaging each domain's child indicators
  updateAllWeightedAvgValues('METRIC_GROUP', 'scenario_val', dataStructure); // calculate the metric group scores by averaging each metric group's child domains
  calculateServiceHWBI();
  runAsterPlot();
});

$('.thumb').on('input', function() {
  var $ele = $(this);
  var sign = $ele.attr("data-sign");
  var units = $ele.attr("data-units");
  var val = 0;
  var roundValue = 2;
  if (sign === "P") {
    val = (+$ele.val() * (+$ele.attr("data-max") - +$ele.attr("data-min"))) + +$ele.attr("data-min");
  } else if (sign === "N") {
    val = -1 * ((+$ele.val() - 1) * (+$ele.attr("data-max") - +$ele.attr("data-min"))) + +$ele.attr("data-min");
  }

  if (units.toLowerCase().trim() === "percent" && $ele.hasClass('customize-hwbi-metrics')) {
    val *= 100;
    roundValue = 1;
  }

  if (units.toLowerCase().trim() === "dollars") {
    roundValue = 2;
  }

  $ele.prev().html("<span> " + round(val, roundValue) + " (" + units + ")</span>");
});

function getScoreDataAJAXCall(location){
  var data = {};

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
                    "MetricScores.SCORE, " +
                    "Counties.COUNTY_NAME, " +
                    "Counties.STATE_CODE, " +
                    "MetricGroups.METRIC_GROUP, " +
                    "MetricScores.MINVAL, " +
                    "MetricScores.MAXVAL, " +
                    "MetricScores.POS_NEG_METRIC, " +
                    "MetricVariables.ORIG_UNITS, " +
                    "MetricVariables.ID as METRIC_ID, " +
                    "MetricGroups.ID as METRIC_GROUP_ID " +
  "FROM MetricScores " +
  "INNER JOIN Counties ON MetricScores.FIPS == Counties.FIPS " +
  "INNER JOIN MetricVariables ON MetricScores.METRIC_VAR_ID == MetricVariables.ID " +
  "INNER JOIN MetricGroups ON MetricVariables.METRIC_GROUP_ID == MetricGroups.ID  " +
  "WHERE Counties.COUNTY_NAME ==? AND Counties.STATE_CODE ==?";

  db.all(sql, [county, state], (err, rows) => {
    if (err) {
      throw err;
    }
    rows.forEach((row) => {
      var $ele = $('[data-var="' + row.METRIC_ID + '"]'); //change to id?
      var rawVal = 0;
      var metricType;
      var roundValue = 3;
      if (row.POS_NEG_METRIC === "P") {
        rawVal = (row.SCORE * (row.MAXVAL - row.MINVAL) + row.MINVAL);
      } else if (row.POS_NEG_METRIC === "N") {
        rawVal = -1 * ((row.SCORE - 1) * (row.MAXVAL - row.MINVAL)) + row.MINVAL;
      }

      if (row.ORIG_UNITS.toLowerCase().trim() === "percent" && row.METRIC_GROUP.toLowerCase() === "hwbi") {
        rawVal *= 100;
        roundValue = 1;
      }

      if (row.ORIG_UNITS.toLowerCase().trim() === "dollars") {
        roundValue = 2;
      }

      $ele.val(row.SCORE); // set the metric scores
      $ele.prev().html("<span> " + round(rawVal, roundValue) + " (" + row.ORIG_UNITS + ")</span>");
      if (row.METRIC_GROUP_ID == 1) {
        metricType = "HWBI_METRIC";
      } else if (row.METRIC_GROUP_ID == 2 || row.METRIC_GROUP_ID == 3 || row.METRIC_GROUP_ID == 4) {
        metricType = "SERVICE_METRIC";
      }
      dataStructure[metricType][row.METRIC_ID].pos_neg = row.POS_NEG_METRIC; // add the metric score to the data structure
      dataStructure[metricType][row.METRIC_ID].original_val = row.SCORE; // add the metric score to the data structure
      dataStructure[metricType][row.METRIC_ID].custom_val = row.SCORE; // add the metric score to the data structure
      dataStructure[metricType][row.METRIC_ID].scenario_val = row.SCORE; // add the metric score to the data structure
    });
   
    setAllInitialAvgValues('SERVICE_INDICATOR', dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
    setAllInitialAvgValues('SERVICE_DOMAIN', dataStructure); // calculate the domain scores by averaging each domain's child indicators

    setAllInitialAvgValues('HWBI_INDICATOR', dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
    setAllInitialAvgValues('HWBI_DOMAIN', dataStructure); // calculate the domain scores by averaging each domain's child indicators

    setAllInitialAvgValues('METRIC_GROUP', dataStructure); // calculate the domain scores by averaging each domain's child indicators
    setAllInitialWeightedAvgValues('METRIC_GROUP', dataStructure); // calculate the metric group scores by averaging each metric group's child domains

    setScoreData(state, county, "original_val"); // set the domain scores

    econChart.updateSeries([round(dataStructure.METRIC_GROUP["2"].original_val * 100, 1)]);
    ecoChart.updateSeries([round(dataStructure.METRIC_GROUP["3"].original_val * 100, 1)]);
    socialChart.updateSeries([round(dataStructure.METRIC_GROUP["4"].original_val * 100, 1)]);

    loadSkillbar(); // update the colored bars on the snapshot page
    runAsterPlot(); //draw aster plot

    $('.preload').fadeOut();
    $('.preload-wrapper').delay(350).fadeOut('slow');
    $('#community-snapshot-tab').delay(350).show();
  }
)};

function createDataStructure(obj) {
  var sql = "SELECT MetricGroups.METRIC_GROUP as METRIC_GROUP, Domains.DOMAIN AS DOMAIN, Indicators.INDICATOR as INDICATOR, MetricVariables.METRIC_VAR, " +
  "MetricGroups.ID as METRIC_GROUP_ID, Domains.ID AS DOMAIN_ID, Indicators.ID as INDICATOR_ID, MetricVariables.ID as METRIC_ID " +
  "FROM MetricVariables " +
  "INNER JOIN MetricGroups ON MetricVariables.METRIC_GROUP_ID == MetricGroups.ID " +
  "INNER JOIN Domains ON MetricVariables.DOMAIN_ID == Domains.ID " +
  "INNER JOIN Indicators ON MetricVariables.INDICATOR_ID == Indicators.ID;";

  db.all(sql, [], (err, rows) => {
    if (err) {
      throw err;
    }
    rows.forEach((row) => {

      // Create MetricGroup if it doesn't exist
      if (!obj.METRIC_GROUP.hasOwnProperty(row.METRIC_GROUP_ID)) {
        obj.METRIC_GROUP[row.METRIC_GROUP_ID] = new Node(row.METRIC_GROUP, [], 0, 0, 0, null, "METRIC_GROUP", row.METRIC_GROUP_ID);
      }

      if (row.METRIC_GROUP_ID == 1) { // 1 === HWBI MetricGroup
        // Create HWBI Domain if it doesn't exist
        if (!obj.HWBI_DOMAIN.hasOwnProperty(row.DOMAIN_ID)) {
          obj.HWBI_DOMAIN[row.DOMAIN_ID] = new Node(row.DOMAIN, [], 0, 0, 0, obj.METRIC_GROUP[row.METRIC_GROUP_ID], "HWBI_DOMAIN", row.DOMAIN_ID);
        }
        // Create HWBI Indicator if it doesn't exist
        if (!obj.HWBI_INDICATOR.hasOwnProperty(row.DOMAIN_ID + '_' + row.INDICATOR_ID)) {
          obj.HWBI_INDICATOR[row.DOMAIN_ID + '_' + row.INDICATOR_ID] = new Node(row.INDICATOR, [], 0, 0, 0, obj.HWBI_DOMAIN[row.DOMAIN_ID], "HWBI_INDICATOR", row.DOMAIN_ID + '_' + row.INDICATOR_ID);
        }
        // Create HWBI Metric if it doesn't exist
        if (!obj.HWBI_METRIC.hasOwnProperty(row.METRIC_ID)) {
          obj.HWBI_METRIC[row.METRIC_ID] = new Node(row.METRIC_VAR, [], 0, 0, 0, obj.HWBI_INDICATOR[row.DOMAIN_ID + '_' + row.INDICATOR_ID], "HWBI_METRIC", row.METRIC_ID);
        }
        // Create HWBI Metric Group child if it doesn't exist
        if (obj.METRIC_GROUP[row.METRIC_GROUP_ID].children.indexOf(obj.HWBI_DOMAIN[row.DOMAIN_ID]) < 0) {
          obj.METRIC_GROUP[row.METRIC_GROUP_ID].children.push(obj.HWBI_DOMAIN[row.DOMAIN_ID]);
        }
        // Create HWBI Domain child if it doesn't exist
        if (obj.HWBI_DOMAIN[row.DOMAIN_ID].children.indexOf(obj.HWBI_INDICATOR[row.DOMAIN_ID + '_' + row.INDICATOR_ID]) < 0) {
          obj.HWBI_DOMAIN[row.DOMAIN_ID].children.push(obj.HWBI_INDICATOR[row.DOMAIN_ID + '_' + row.INDICATOR_ID]);
        }
        // Create HWBI Indicator child if it doesn't exist
        if (obj.HWBI_INDICATOR[row.DOMAIN_ID + '_' + row.INDICATOR_ID].children.indexOf(obj.HWBI_METRIC[row.METRIC_VAR]) < 0) {
          obj.HWBI_INDICATOR[row.DOMAIN_ID + '_' + row.INDICATOR_ID].children.push(obj.HWBI_METRIC[row.METRIC_ID]);
        }
      } else if (row.METRIC_GROUP_ID == 2 || row.METRIC_GROUP_ID == 3 || row.METRIC_GROUP_ID == 4) { // 2,3,4 == Economic, Ecosystem, Social MetricGroups
        if (!obj.SERVICE_DOMAIN.hasOwnProperty(row.DOMAIN_ID)) {
          obj.SERVICE_DOMAIN[row.DOMAIN_ID] = new Node(row.DOMAIN, [], 0, 0, 0, obj.METRIC_GROUP[row.METRIC_GROUP_ID], "SERVICE_DOMAIN", row.DOMAIN_ID);
        }
        if (!obj.SERVICE_INDICATOR.hasOwnProperty(row.DOMAIN_ID + '_' + row.INDICATOR_ID)) {
          obj.SERVICE_INDICATOR[row.DOMAIN_ID + '_' + row.INDICATOR_ID] = new Node(row.INDICATOR, [], 0, 0, 0, obj.SERVICE_DOMAIN[row.DOMAIN_ID], "SERVICE_INDICATOR", row.DOMAIN_ID + '_' + row.INDICATOR_ID);
        }
        if (!obj.SERVICE_METRIC.hasOwnProperty(row.METRIC_ID)) {
          obj.SERVICE_METRIC[row.METRIC_ID] = new Node(row.METRIC_VAR, [], 0, 0, 0, obj.SERVICE_INDICATOR[row.DOMAIN_ID + '_' + row.INDICATOR_ID], "SERVICE_METRIC", row.METRIC_ID);
        }
        if (obj.METRIC_GROUP[row.METRIC_GROUP_ID].children.indexOf(obj.SERVICE_DOMAIN[row.DOMAIN_ID]) < 0) {
          obj.METRIC_GROUP[row.METRIC_GROUP_ID].children.push(obj.SERVICE_DOMAIN[row.DOMAIN_ID]);
        }
        if (obj.SERVICE_DOMAIN[row.DOMAIN_ID].children.indexOf(obj.SERVICE_INDICATOR[row.DOMAIN_ID + '_' + row.INDICATOR_ID]) < 0) {
          obj.SERVICE_DOMAIN[row.DOMAIN_ID].children.push(obj.SERVICE_INDICATOR[row.DOMAIN_ID + '_' + row.INDICATOR_ID]);
        }
        if (obj.SERVICE_INDICATOR[row.DOMAIN_ID + '_' + row.INDICATOR_ID].children.indexOf(obj.SERVICE_METRIC[row.METRIC_ID]) < 0) {
          obj.SERVICE_INDICATOR[row.DOMAIN_ID + '_' + row.INDICATOR_ID].children.push(obj.SERVICE_METRIC[row.METRIC_ID]);
        }
      }
    });
  });
}

function Node(name, children, original_val, custom_val, scenario_val, parent, type, id) {
  this.id = id;
  this.name = name;
  this.children = children;
  this.original_val = original_val;
  this.custom_val = custom_val;
  this.scenario_val = scenario_val;
  this.parent = parent;
  this.type = type;
  if (type === "HWBI_DOMAIN") {
    this.weight = 1;
  }
}

// a('INDICATOR', 'original_val'); // calculate the indicator scores by averaging each indicator's child metrics
// set the 'value' to the average of the children Node's 'value' for the specified 'thing'
function updateAllAvgValues(thing, value, obj) {
	for (var indicator in obj[thing]) {
    var sum = function (items, prop) {
      return items.reduce( function(a, b) {
        return a + b[prop];
      }, 0);
    };
    var avg = sum(obj[thing][indicator].children, value) / obj[thing][indicator].children.length;
		obj[thing][indicator][value] = avg;
  }
}

function updateAllWeightedAvgValues(thing, value, obj) {
	for (var indicator in obj[thing]) {
    if (obj[thing][indicator].children[0].hasOwnProperty("weight")) {
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
      var avg = weightedSum(obj[thing][indicator].children, value) / sum(obj[thing][indicator].children, "weight");
      obj[thing][indicator][value] = avg;
    }
  }
}

function setAllInitialAvgValues(thing, obj) {
	for (var indicator in obj[thing]) {
    var sum = function (items, prop) {
      return items.reduce( function(a, b) {
        return a + b[prop];
      }, 0);
    };
    var avg = sum(obj[thing][indicator].children, "original_val") / obj[thing][indicator].children.length;
    obj[thing][indicator]["original_val"] = avg;
    obj[thing][indicator]["custom_val"] = avg;
    obj[thing][indicator]["scenario_val"] = avg;
  }
}

function setAllInitialWeightedAvgValues(thing, obj) {
	for (var indicator in obj[thing]) {
    if (obj[thing][indicator].children[0].hasOwnProperty("weight")) {
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
      var avg = weightedSum(obj[thing][indicator].children, "original_val") / sum(obj[thing][indicator].children, "weight");
      obj[thing][indicator]["original_val"] = avg;
      obj[thing][indicator]["custom_val"] = avg;
      obj[thing][indicator]["scenario_val"] = avg;
    }
  }
}

function runAsterPlot() {
  var asterData = [];
  for (var domain in dataStructure.HWBI_DOMAIN) {
    if (dataStructure.HWBI_DOMAIN[domain].parent.name == "HWBI") {
      asterData.push({
          description: dataStructure.HWBI_DOMAIN[domain].name,
          weight: dataStructure.HWBI_DOMAIN[domain].weight,
          score: dataStructure.HWBI_DOMAIN[domain].scenario_val * 100
      });
    }
  }

  if (drawn === false) {
    drawAsterPlot(asterData);
  } else {
    updateAsterPlot(asterData);
  }
}

function getStateDomainScore(state, domain) {

  var sql = "SELECT avg(MetricScores.SCORE) " +
  "FROM MetricScores " +
  "INNER JOIN Counties ON MetricScores.FIPS == Counties.FIPS " +
  "INNER JOIN MetricVariables ON MetricScores.METRIC_VAR_ID == MetricVariables.ID " +
  "INNER JOIN MetricGroups ON MetricVariables.METRIC_GROUP_ID == MetricGroups.ID " +
  "INNER JOIN Domains ON MetricVariables.DOMAIN_ID == Domains.ID " +
  "INNER JOIN Indicators ON MetricVariables.INDICATOR_ID == Indicators.ID " +
  'WHERE Counties.STATE_CODE ==? AND METRIC_GROUP="HWBI" AND Domains.DOMAIN=?';

  db.all(sql, [state, domain], (err, rows) => {
    if (err) {
      throw err;
    }
    rows.forEach((row) => {
      console.log(row.SCORE)
    });
  });
}

function getStateDomainScores(state) {
  var sql = `SELECT DOMAIN, avg(SCORE) as SCORE from(
    SELECT Domains.DOMAIN, Indicators.INDICATOR, avg(MetricScores.SCORE) as SCORE
      FROM MetricScores
      INNER JOIN Counties ON MetricScores.FIPS == Counties.FIPS
      INNER JOIN MetricVariables ON MetricScores.METRIC_VAR_ID == MetricVariables.ID
      INNER JOIN MetricGroups ON MetricVariables.METRIC_GROUP_ID == MetricGroups.ID 
      INNER JOIN Domains ON MetricVariables.DOMAIN_ID == Domains.ID
      INNER JOIN Indicators ON MetricVariables.INDICATOR_ID == Indicators.ID
      WHERE Counties.STATE_CODE ==? AND METRIC_GROUP="HWBI"
      Group By Domains.DOMAIN, Indicators.INDICATOR) Group By DOMAIN`;
  db.all(sql, [state], (err, rows) => {
    if (err) {
      throw err;
    }
    rows.forEach((row) => {
      $("#" + slugify(row.DOMAIN) + "_state_score").html(round(row.SCORE * 100, 1));
    });
  });
}

function getNationalDomainScores() {
  var sql = `SELECT DOMAIN, avg(SCORE) as SCORE from(
    SELECT Domains.DOMAIN, Indicators.INDICATOR, avg(MetricScores.SCORE) as SCORE
      FROM MetricScores
      INNER JOIN Counties ON MetricScores.FIPS == Counties.FIPS
      INNER JOIN MetricVariables ON MetricScores.METRIC_VAR_ID == MetricVariables.ID
      INNER JOIN MetricGroups ON MetricVariables.METRIC_GROUP_ID == MetricGroups.ID 
      INNER JOIN Domains ON MetricVariables.DOMAIN_ID == Domains.ID
      INNER JOIN Indicators ON MetricVariables.INDICATOR_ID == Indicators.ID
      WHERE METRIC_GROUP="HWBI"
      Group By Domains.DOMAIN, Indicators.INDICATOR) Group By DOMAIN`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      throw err;
    }
    rows.forEach((row) => {
      $("#" + slugify(row.DOMAIN) + "_national_score").html(round(row.SCORE * 100, 1));
    });
  });
}

function getStateDISCScore(state) {
  var sql = `SELECT avg(SCORE) as SCORE FROM (
    SELECT DOMAIN, avg(SCORE) as SCORE from(
    SELECT Domains.DOMAIN, Indicators.INDICATOR, avg(MetricScores.SCORE) as SCORE
      FROM MetricScores
      INNER JOIN Counties ON MetricScores.FIPS == Counties.FIPS
      INNER JOIN MetricVariables ON MetricScores.METRIC_VAR_ID == MetricVariables.ID
      INNER JOIN MetricGroups ON MetricVariables.METRIC_GROUP_ID == MetricGroups.ID 
      INNER JOIN Domains ON MetricVariables.DOMAIN_ID == Domains.ID
      INNER JOIN Indicators ON MetricVariables.INDICATOR_ID == Indicators.ID
      WHERE Counties.STATE_CODE=? AND METRIC_GROUP="HWBI"
      Group By Domains.DOMAIN, Indicators.INDICATOR) Group By DOMAIN)`;
  db.all(sql, [state], (err, rows) => {
    if (err) {
      throw err;
    }
    rows.forEach((row) => {
      $("#disc_state_score").html(round(row.SCORE * 100, 1));
    });
  });
}

function getNationalDISCScore() {
  var sql = `SELECT avg(SCORE) as SCORE FROM (
    SELECT DOMAIN, avg(SCORE) as SCORE from(
    SELECT Domains.DOMAIN, Indicators.INDICATOR, avg(MetricScores.SCORE) as SCORE
      FROM MetricScores
      INNER JOIN Counties ON MetricScores.FIPS == Counties.FIPS
      INNER JOIN MetricVariables ON MetricScores.METRIC_VAR_ID == MetricVariables.ID
      INNER JOIN MetricGroups ON MetricVariables.METRIC_GROUP_ID == MetricGroups.ID 
      INNER JOIN Domains ON MetricVariables.DOMAIN_ID == Domains.ID
      INNER JOIN Indicators ON MetricVariables.INDICATOR_ID == Indicators.ID
      WHERE METRIC_GROUP="HWBI"
      Group By Domains.DOMAIN, Indicators.INDICATOR) Group By DOMAIN)`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      throw err;
    }
    rows.forEach((row) => {
      $("#disc_national_score").html(round(row.SCORE * 100, 1));
    });
  });
}

function slugify(string) {
  return string.replace(/ /g, '-').replace(/[^0-9a-z-_]/gi, '').toLowerCase().trim();
}

getNationalDomainScores();
getNationalDISCScore();

function calculateServiceHWBI() {
  var val;
  val = dataStructure.HWBI_DOMAIN["1"]["custom_val"] + (2.431227 +
    0.577159 * dataStructure.SERVICE_DOMAIN["13"]["custom_val"] +
    -1.755944 * dataStructure.SERVICE_DOMAIN["9"]["custom_val"] +
    -0.370377 * dataStructure.SERVICE_DOMAIN["28"]["custom_val"] +
    0.465541 * dataStructure.SERVICE_DOMAIN["14"]["custom_val"] +
    -0.111739 * dataStructure.SERVICE_DOMAIN["22"]["custom_val"] +
    -2.388524 * dataStructure.SERVICE_DOMAIN["16"]["custom_val"] +
    -0.524012 * dataStructure.SERVICE_DOMAIN["21"]["custom_val"] +
    0.05051 * dataStructure.SERVICE_DOMAIN["29"]["custom_val"] +
    -1.934059 * dataStructure.SERVICE_DOMAIN["25"]["custom_val"] +
    0.211648 * dataStructure.SERVICE_DOMAIN["15"]["custom_val"] +
    -1.998989 * dataStructure.SERVICE_DOMAIN["13"]["custom_val"] * dataStructure.SERVICE_DOMAIN["16"]["custom_val"] +
    2.103267 * dataStructure.SERVICE_DOMAIN["9"]["custom_val"] * dataStructure.SERVICE_DOMAIN["16"]["custom_val"] +
    3.222831 * dataStructure.SERVICE_DOMAIN["16"]["custom_val"] * dataStructure.SERVICE_DOMAIN["25"]["custom_val"]
  ) -
  (2.431227 +
    0.577159 * dataStructure.SERVICE_DOMAIN["13"]["scenario_val"] +
    -1.755944 * dataStructure.SERVICE_DOMAIN["9"]["scenario_val"] +
    -0.370377 * dataStructure.SERVICE_DOMAIN["28"]["scenario_val"] +
    0.465541 * dataStructure.SERVICE_DOMAIN["14"]["scenario_val"] +
    -0.111739 * dataStructure.SERVICE_DOMAIN["22"]["scenario_val"] +
    -2.388524 * dataStructure.SERVICE_DOMAIN["16"]["scenario_val"] +
    -0.524012 * dataStructure.SERVICE_DOMAIN["21"]["scenario_val"] +
    0.05051 * dataStructure.SERVICE_DOMAIN["29"]["scenario_val"] +
    -1.934059 * dataStructure.SERVICE_DOMAIN["25"]["scenario_val"] +
    0.211648 * dataStructure.SERVICE_DOMAIN["15"]["scenario_val"] +
    -1.998989 * dataStructure.SERVICE_DOMAIN["13"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["16"]["scenario_val"] +
    2.103267 * dataStructure.SERVICE_DOMAIN["9"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["16"]["scenario_val"] +
    3.222831 * dataStructure.SERVICE_DOMAIN["16"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["25"]["scenario_val"]
  );
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["1"]["scenario_val"] = val; 

  val = dataStructure.HWBI_DOMAIN["2"]["custom_val"] + (-0.22391 +
    2.429595 * dataStructure.SERVICE_DOMAIN["13"]["custom_val"] +
    -0.100712 * dataStructure.SERVICE_DOMAIN["10"]["custom_val"] +
    -0.131353 * dataStructure.SERVICE_DOMAIN["29"]["custom_val"] +
    0.084694 * dataStructure.SERVICE_DOMAIN["16"]["custom_val"] +
    0.191835 * dataStructure.SERVICE_DOMAIN["15"]["custom_val"] +
    0.09992 * dataStructure.SERVICE_DOMAIN["23"]["custom_val"] +
    1.280481 * dataStructure.SERVICE_DOMAIN["12"]["custom_val"] +
    -0.097182 * dataStructure.SERVICE_DOMAIN["26"]["custom_val"] +
    -4.405586 * dataStructure.SERVICE_DOMAIN["13"]["custom_val"] * dataStructure.SERVICE_DOMAIN["12"]["custom_val"] +
    0.23472 * dataStructure.SERVICE_DOMAIN["13"]["custom_val"] * dataStructure.SERVICE_DOMAIN["10"]["custom_val"]
  ) -
  (-0.22391 +
    2.429595 * dataStructure.SERVICE_DOMAIN["13"]["scenario_val"] +
    -0.100712 * dataStructure.SERVICE_DOMAIN["10"]["scenario_val"] +
    -0.131353 * dataStructure.SERVICE_DOMAIN["29"]["scenario_val"] +
    0.084694 * dataStructure.SERVICE_DOMAIN["16"]["scenario_val"] +
    0.191835 * dataStructure.SERVICE_DOMAIN["15"]["scenario_val"] +
    0.09992 * dataStructure.SERVICE_DOMAIN["23"]["scenario_val"] +
    1.280481 * dataStructure.SERVICE_DOMAIN["12"]["scenario_val"] +
    -0.097182 * dataStructure.SERVICE_DOMAIN["26"]["scenario_val"] +
    -4.405586 * dataStructure.SERVICE_DOMAIN["13"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["12"]["scenario_val"] +
    0.23472 * dataStructure.SERVICE_DOMAIN["13"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["10"]["scenario_val"]
  );
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["2"]["scenario_val"] = val; 

  val = dataStructure.HWBI_DOMAIN["15"]["custom_val"] + (0.392837 + // Should be 3 but is 15 due to db errors
    0.350783 * dataStructure.SERVICE_DOMAIN["18"]["custom_val"] +
    0.463786 * dataStructure.SERVICE_DOMAIN["13"]["custom_val"] +
    -0.48866 * dataStructure.SERVICE_DOMAIN["26"]["custom_val"] +
    0.078233 * dataStructure.SERVICE_DOMAIN["27"]["custom_val"] +
    -0.441537 * dataStructure.SERVICE_DOMAIN["24"]["custom_val"] +
    0.574752 * dataStructure.SERVICE_DOMAIN["9"]["custom_val"] +
    -0.37372 * dataStructure.SERVICE_DOMAIN["14"]["custom_val"] +
    0.390576 * dataStructure.SERVICE_DOMAIN["28"]["custom_val"] * dataStructure.SERVICE_DOMAIN["21"]["custom_val"]
  ) -
  (0.392837 +
    0.350783 * dataStructure.SERVICE_DOMAIN["18"]["scenario_val"] +
    0.463786 * dataStructure.SERVICE_DOMAIN["13"]["scenario_val"] +
    -0.48866 * dataStructure.SERVICE_DOMAIN["26"]["scenario_val"] +
    0.078233 * dataStructure.SERVICE_DOMAIN["27"]["scenario_val"] +
    -0.441537 * dataStructure.SERVICE_DOMAIN["24"]["scenario_val"] +
    0.574752 * dataStructure.SERVICE_DOMAIN["9"]["scenario_val"] +
    -0.37372 * dataStructure.SERVICE_DOMAIN["14"]["scenario_val"] +
    0.390576 * dataStructure.SERVICE_DOMAIN["28"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["21"]["scenario_val"]
  );
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["15"]["scenario_val"] = val; // Should be 3 but is 15 due to db errors

  val = (dataStructure.HWBI_DOMAIN["4"]["custom_val"] + 0.231086 +
    0.072714 * dataStructure.SERVICE_DOMAIN["18"]["custom_val"] +
    0.194939 * dataStructure.SERVICE_DOMAIN["12"]["custom_val"] +
    0.097708 * dataStructure.SERVICE_DOMAIN["25"]["custom_val"] +
    0.020422 * dataStructure.SERVICE_DOMAIN["29"]["custom_val"] +
    0.095983 * dataStructure.SERVICE_DOMAIN["23"]["custom_val"] +
    0.04914 * dataStructure.SERVICE_DOMAIN["16"]["custom_val"] +
    0.52497 * dataStructure.SERVICE_DOMAIN["13"]["custom_val"] +
    0.149127 * dataStructure.SERVICE_DOMAIN["24"]["custom_val"] +
    0.050258 * dataStructure.SERVICE_DOMAIN["9"]["custom_val"] * dataStructure.SERVICE_DOMAIN["15"]["custom_val"] +
    -0.866259 * dataStructure.SERVICE_DOMAIN["13"]["custom_val"] * dataStructure.SERVICE_DOMAIN["24"]["custom_val"]
  ) -
  (0.231086 +
    0.072714 * dataStructure.SERVICE_DOMAIN["18"]["scenario_val"] +
    0.194939 * dataStructure.SERVICE_DOMAIN["12"]["scenario_val"] +
    0.097708 * dataStructure.SERVICE_DOMAIN["25"]["scenario_val"] +
    0.020422 * dataStructure.SERVICE_DOMAIN["29"]["scenario_val"] +
    0.095983 * dataStructure.SERVICE_DOMAIN["23"]["scenario_val"] +
    0.04914 * dataStructure.SERVICE_DOMAIN["16"]["scenario_val"] +
    0.52497 * dataStructure.SERVICE_DOMAIN["13"]["scenario_val"] +
    0.149127 * dataStructure.SERVICE_DOMAIN["24"]["scenario_val"] +
    0.050258 * dataStructure.SERVICE_DOMAIN["9"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["15"]["scenario_val"] +
    -0.866259 * dataStructure.SERVICE_DOMAIN["13"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["24"]["scenario_val"]
  );
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["4"]["scenario_val"] = val; 

  val = dataStructure.HWBI_DOMAIN["5"]["custom_val"] + (0.506212 +
    -0.340958 * dataStructure.SERVICE_DOMAIN["17"]["custom_val"] +
    -0.719677 * dataStructure.SERVICE_DOMAIN["29"]["custom_val"] +
    -0.39237 * dataStructure.SERVICE_DOMAIN["14"]["custom_val"] +
    0.682084 * dataStructure.SERVICE_DOMAIN["20"]["custom_val"] +
    -0.053742 * dataStructure.SERVICE_DOMAIN["29"]["custom_val"] +
    0.138196 * dataStructure.SERVICE_DOMAIN["21"]["custom_val"] +
    -0.544925 * dataStructure.SERVICE_DOMAIN["15"]["custom_val"] +
    0.577271 * dataStructure.SERVICE_DOMAIN["27"]["custom_val"] +
    -0.217388 * dataStructure.SERVICE_DOMAIN["13"]["custom_val"] +
    0.934746 * dataStructure.SERVICE_DOMAIN["9"]["custom_val"] +
    1.599972 * dataStructure.SERVICE_DOMAIN["29"]["custom_val"] * dataStructure.SERVICE_DOMAIN["15"]["custom_val"] +
    0.206249 * dataStructure.SERVICE_DOMAIN["19"]["custom_val"] * dataStructure.SERVICE_DOMAIN["12"]["custom_val"] +
    -1.29474 * dataStructure.SERVICE_DOMAIN["27"]["custom_val"] * dataStructure.SERVICE_DOMAIN["9"]["custom_val"] +
    -0.171528 * dataStructure.SERVICE_DOMAIN["15"]["custom_val"] * dataStructure.SERVICE_DOMAIN["23"]["custom_val"]
  ) -
  (0.506212 +
    -0.340958 * dataStructure.SERVICE_DOMAIN["17"]["scenario_val"] +
    -0.719677 * dataStructure.SERVICE_DOMAIN["29"]["scenario_val"] +
    -0.39237 * dataStructure.SERVICE_DOMAIN["14"]["scenario_val"] +
    0.682084 * dataStructure.SERVICE_DOMAIN["20"]["scenario_val"] +
    -0.053742 * dataStructure.SERVICE_DOMAIN["29"]["scenario_val"] +
    0.138196 * dataStructure.SERVICE_DOMAIN["21"]["scenario_val"] +
    -0.544925 * dataStructure.SERVICE_DOMAIN["15"]["scenario_val"] +
    0.577271 * dataStructure.SERVICE_DOMAIN["27"]["scenario_val"] +
    -0.217388 * dataStructure.SERVICE_DOMAIN["13"]["scenario_val"] +
    0.934746 * dataStructure.SERVICE_DOMAIN["9"]["scenario_val"] +
    1.599972 * dataStructure.SERVICE_DOMAIN["29"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["15"]["scenario_val"] +
    0.206249 * dataStructure.SERVICE_DOMAIN["19"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["12"]["scenario_val"] +
    -1.29474 * dataStructure.SERVICE_DOMAIN["27"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["9"]["scenario_val"] +
    -0.171528 * dataStructure.SERVICE_DOMAIN["15"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["23"]["scenario_val"]
  );
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["5"]["scenario_val"] = val; 

  val = dataStructure.HWBI_DOMAIN["6"]["custom_val"] + (0.275027 +
    0.092259 * dataStructure.SERVICE_DOMAIN["17"]["custom_val"] +
    -0.146247 * dataStructure.SERVICE_DOMAIN["27"]["custom_val"] +
    0.134713 * dataStructure.SERVICE_DOMAIN["25"]["custom_val"] +
    0.367559 * dataStructure.SERVICE_DOMAIN["9"]["custom_val"] +
    -0.259411 * dataStructure.SERVICE_DOMAIN["19"]["custom_val"] +
    -0.17859 * dataStructure.SERVICE_DOMAIN["24"]["custom_val"] +
    0.078427 * dataStructure.SERVICE_DOMAIN["29"]["custom_val"] +
    -0.024932 * dataStructure.SERVICE_DOMAIN["11"]["custom_val"] +
    0.708609 * dataStructure.SERVICE_DOMAIN["27"]["custom_val"] * dataStructure.SERVICE_DOMAIN["19"]["custom_val"] +
    -0.038308 * dataStructure.SERVICE_DOMAIN["11"]["custom_val"] * dataStructure.SERVICE_DOMAIN["29"]["custom_val"] +
    0.177212 * dataStructure.SERVICE_DOMAIN["20"]["custom_val"] * dataStructure.SERVICE_DOMAIN["12"]["custom_val"]
  ) - 
  (0.275027 +
    0.092259 * dataStructure.SERVICE_DOMAIN["17"]["scenario_val"] +
    -0.146247 * dataStructure.SERVICE_DOMAIN["27"]["scenario_val"] +
    0.134713 * dataStructure.SERVICE_DOMAIN["25"]["scenario_val"] +
    0.367559 * dataStructure.SERVICE_DOMAIN["9"]["scenario_val"] +
    -0.259411 * dataStructure.SERVICE_DOMAIN["19"]["scenario_val"] +
    -0.17859 * dataStructure.SERVICE_DOMAIN["24"]["scenario_val"] +
    0.078427 * dataStructure.SERVICE_DOMAIN["29"]["scenario_val"] +
    -0.024932 * dataStructure.SERVICE_DOMAIN["11"]["scenario_val"] +
    0.708609 * dataStructure.SERVICE_DOMAIN["27"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["19"]["scenario_val"] +
    -0.038308 * dataStructure.SERVICE_DOMAIN["11"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["29"]["scenario_val"] +
    0.177212 * dataStructure.SERVICE_DOMAIN["20"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["12"]["scenario_val"]
  );
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["6"]["scenario_val"] = val; 

  val = dataStructure.HWBI_DOMAIN["7"]["custom_val"] + (0.603914 +
    0.294092 * dataStructure.SERVICE_DOMAIN["13"]["custom_val"] +
    -0.380562 * dataStructure.SERVICE_DOMAIN["29"]["custom_val"] +
    -0.385317 * dataStructure.SERVICE_DOMAIN["27"]["custom_val"] +
    0.085398 * dataStructure.SERVICE_DOMAIN["29"]["custom_val"] +
    1.35322 * dataStructure.SERVICE_DOMAIN["9"]["custom_val"] * dataStructure.SERVICE_DOMAIN["25"]["custom_val"] +
    -0.304328 * dataStructure.SERVICE_DOMAIN["26"]["custom_val"] * dataStructure.SERVICE_DOMAIN["22"]["custom_val"] +
    -1.147411 * dataStructure.SERVICE_DOMAIN["25"]["custom_val"] * dataStructure.SERVICE_DOMAIN["24"]["custom_val"] +
    0.295058 * dataStructure.SERVICE_DOMAIN["26"]["custom_val"] * dataStructure.SERVICE_DOMAIN["20"]["custom_val"] +
    -0.742299 * dataStructure.SERVICE_DOMAIN["21"]["custom_val"] * dataStructure.SERVICE_DOMAIN["16"]["custom_val"] +
    -0.602264 * dataStructure.SERVICE_DOMAIN["9"]["custom_val"] * dataStructure.SERVICE_DOMAIN["19"]["custom_val"] +
    0.898598 * dataStructure.SERVICE_DOMAIN["24"]["custom_val"] * dataStructure.SERVICE_DOMAIN["16"]["custom_val"] +
    0.574027 * dataStructure.SERVICE_DOMAIN["27"]["custom_val"] * dataStructure.SERVICE_DOMAIN["19"]["custom_val"] +
    0.655645 * dataStructure.SERVICE_DOMAIN["29"]["custom_val"] * dataStructure.SERVICE_DOMAIN["27"]["custom_val"]
  ) -
  (0.603914 +
    0.294092 * dataStructure.SERVICE_DOMAIN["13"]["scenario_val"] +
    -0.380562 * dataStructure.SERVICE_DOMAIN["29"]["scenario_val"] +
    -0.385317 * dataStructure.SERVICE_DOMAIN["27"]["scenario_val"] +
    0.085398 * dataStructure.SERVICE_DOMAIN["29"]["scenario_val"] +
    1.35322 * dataStructure.SERVICE_DOMAIN["9"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["25"]["scenario_val"] +
    -0.304328 * dataStructure.SERVICE_DOMAIN["26"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["22"]["scenario_val"] +
    -1.147411 * dataStructure.SERVICE_DOMAIN["25"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["24"]["scenario_val"] +
    0.295058 * dataStructure.SERVICE_DOMAIN["26"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["20"]["scenario_val"] +
    -0.742299 * dataStructure.SERVICE_DOMAIN["21"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["16"]["scenario_val"] +
    -0.602264 * dataStructure.SERVICE_DOMAIN["9"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["19"]["scenario_val"] +
    0.898598 * dataStructure.SERVICE_DOMAIN["24"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["16"]["scenario_val"] +
    0.574027 * dataStructure.SERVICE_DOMAIN["27"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["19"]["scenario_val"] +
    0.655645 * dataStructure.SERVICE_DOMAIN["29"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["27"]["scenario_val"]
  );
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["7"]["scenario_val"] = val; 

  val = dataStructure.HWBI_DOMAIN["8"]["custom_val"] + (-0.810156 +
    1.07278 * dataStructure.SERVICE_DOMAIN["24"]["custom_val"] +
    0.042486 * dataStructure.SERVICE_DOMAIN["10"]["custom_val"] +
    -0.382991 * dataStructure.SERVICE_DOMAIN["26"]["custom_val"] +
    1.980596 * dataStructure.SERVICE_DOMAIN["13"]["custom_val"] +
    0.047261 * dataStructure.SERVICE_DOMAIN["27"]["custom_val"] +
    1.282272 * dataStructure.SERVICE_DOMAIN["28"]["custom_val"] +
    0.100406 * dataStructure.SERVICE_DOMAIN["11"]["custom_val"] +
    0.152944 * dataStructure.SERVICE_DOMAIN["18"]["custom_val"] +
    0.120707 * dataStructure.SERVICE_DOMAIN["25"]["custom_val"] + 
    1.291316 * dataStructure.SERVICE_DOMAIN["21"]["custom_val"] + 
    -0.148073 * dataStructure.SERVICE_DOMAIN["14"]["custom_val"] + 
    -3.59425 * dataStructure.SERVICE_DOMAIN["13"]["custom_val"] * dataStructure.SERVICE_DOMAIN["28"]["custom_val"] +
    -2.048002 * dataStructure.SERVICE_DOMAIN["24"]["custom_val"] * dataStructure.SERVICE_DOMAIN["21"]["custom_val"] +
    -0.036457 * dataStructure.SERVICE_DOMAIN["17"]["custom_val"] * dataStructure.SERVICE_DOMAIN["29"]["custom_val"]
  ) - (-0.810156 +
    1.07278 * dataStructure.SERVICE_DOMAIN["24"]["scenario_val"] +
    0.042486 * dataStructure.SERVICE_DOMAIN["10"]["scenario_val"] +
    -0.382991 * dataStructure.SERVICE_DOMAIN["26"]["scenario_val"] +
    1.980596 * dataStructure.SERVICE_DOMAIN["13"]["scenario_val"] +
    0.047261 * dataStructure.SERVICE_DOMAIN["27"]["scenario_val"] +
    1.282272 * dataStructure.SERVICE_DOMAIN["28"]["scenario_val"] +
    0.100406 * dataStructure.SERVICE_DOMAIN["11"]["scenario_val"] +
    0.152944 * dataStructure.SERVICE_DOMAIN["18"]["scenario_val"] +
    0.120707 * dataStructure.SERVICE_DOMAIN["25"]["scenario_val"] + 
    1.291316 * dataStructure.SERVICE_DOMAIN["21"]["scenario_val"] + 
    -0.148073 * dataStructure.SERVICE_DOMAIN["14"]["scenario_val"] + 
    -3.59425 * dataStructure.SERVICE_DOMAIN["13"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["28"]["scenario_val"] +
    -2.048002 * dataStructure.SERVICE_DOMAIN["24"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["21"]["scenario_val"] +
    -0.036457 * dataStructure.SERVICE_DOMAIN["17"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["29"]["scenario_val"]
  );
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["8"]["scenario_val"] = val;
}

function loadMetricValues(valueType) {
  var choice = dialog.showMessageBox(
    {
      type: 'question',
      buttons: ['Yes', 'No'],
      title: 'Load Customized Service Metric Values',
      message: 'Loading customized values will reset any changes you have made below.\n\nDo you still want to proceed?'
    });
  if (choice === 0) {
    setServiceScenarioValue(valueType);
    updateAllAvgValues('SERVICE_INDICATOR', 'scenario_val', dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
    updateAllAvgValues('SERVICE_DOMAIN', 'scenario_val', dataStructure); // calculate the domain scores by averaging each domain's child indicators
    updateAllWeightedAvgValues('METRIC_GROUP', 'scenario_val', dataStructure); // calculate the metric group scores by averaging each metric group's child domains
    calculateServiceHWBI();
    runAsterPlot();
  }
}

function setServiceScenarioValue(valueType) {
  for (var metricName in dataStructure.SERVICE_METRIC) {
      var metric = dataStructure.SERVICE_METRIC[metricName];
      metric.scenario_val = metric[valueType];
      $('[data-var="' + metric.id + '"].scenario-builder-metric').val(metric[valueType]);
  }
}

var donut = donutChart()
        .width(540)
        .height(300)
        .transTime(250) // length of transitions in ms
        .cornerRadius(3) // sets how rounded the corners are on each slice
        .padAngle(0.015) // effectively dictates the gap between slices
        .variable('Weight')
        .category('Domain');

function initializeRankingDonut() {
  if (!$('#ranking-chart svg').length) {
    var data = [];
    for (var domain in dataStructure.HWBI_DOMAIN) {
      data.push({
              Domain: dataStructure.HWBI_DOMAIN[domain].name,
              Weight: dataStructure.HWBI_DOMAIN[domain].weight	
          });
    }
    donut.data(data);
    d3.select('#ranking-chart')
                .call(donut); // draw chart in div
  }
}

// Listen for open file from main process
ipcRenderer.on('open-file', (event, arg) => {
  console.log(arg);
});
