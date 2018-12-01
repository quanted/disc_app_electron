var dragVal = {};

var shell = nodeRequire('electron').shell;
//open links externally by default
$(document).on('click', 'a[href^="http"]', function(event) {
    console.log("catch link");
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
//const SQL = nodeRequire('sql.js');

// fs.readdirSync('.').forEach(file => {
//   console.log(file);
// })

SQL.dbOpen = function (databaseFileName) {
  try {
    return new SQL.Database(fs.readFileSync(databaseFileName));
  } catch (error) {
    console.log("Can't open database file.", error.message);
    return null;
  }
}

SQL.dbClose = function (databaseHandle, databaseFileName) {
  try {
    let data = databaseHandle.export();
    let buffer = Buffer.alloc(data.length, data);
    fs.writeFileSync(databaseFileName, buffer);
    databaseHandle.close();
    return true;
  } catch (error) {
    console.log("Can't close database file.", error);
    return null;
  }
}
let dbPath;

//console.log(path.join(__dirname, '/hwbi_app/hwbi_db.sqlite3'));
//console.log(path.join(__dirname, '/resources/app/hwbi_app/hwbi_db.sqlite3'));
//console.log(fs.existsSync(path.join(__dirname, '/hwbi_app/hwbi_db.sqlite3')));
//console.log(fs.existsSync(path.join(__dirname, '/resources/app/hwbi_app/hwbi_db.sqlite3')));
//console.log(fs.existsSync(path.join(__dirname, '/resources/app.asar/hwbi_app/hwbi_db.sqlite3')));

if (fs.existsSync(path.join(__dirname, '/hwbi_app/hwbi_db_v2.sqlite3'))) {
  dbPath = path.join(__dirname, '/hwbi_app/hwbi_db_v2.sqlite3'); //Not built
} else if (fs.existsSync(path.join(__dirname, '/resources/app/hwbi_app/hwbi_db_v2.sqlite3'))) {
  dbPath = path.join(__dirname, '/resources/app/hwbi_app/hwbi_db_v2.sqlite3'); //Built but not ASAR
} else {
  dbPath = path.join(__dirname, '/resources/app.asar/hwbi_app/hwbi_db_v2.sqlite3'); //ASAR packaged
}

console.log(dbPath);
fs.existsSync(dbPath);
let db = SQL.dbOpen(dbPath);
let dbOLD = SQL.dbOpen(path.join(__dirname, "/hwbi_app/hwbi_db_v2.sqlite3.old"));

if (db === null) {
  /* The file doesn't exist so create a new database. */
  console.log("The file doesn't exist");
} else {
  /*
    The file is a valid sqlite3 database. This simple query will demonstrate
    whether it's in good health or not.
  */
  let query = 'SELECT count(*) as `count` FROM `sqlite_master`';
  let row = db.exec(query);
  let tableCount = parseInt(row[0].values);
  if (tableCount === 0) {
    console.log('The file is an empty SQLite3 database.');
    //createDb(dbPath);
  } else {
    console.log('The database has', tableCount, 'tables.');
  }
  if (typeof callback === 'function') {
    callback();
  }
}

function get_county_indicator_data (state = "", county = ""){
  if (state === "" || county === "") {
    return [];
  }
  var indicators = [];  

  var stmt = db.prepare("SELECT Indicators.indicator, CountyIndicatorScores.score, CountyIndicatorScores.countyFIPS, Counties.county, Counties.stateID " +
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
  
  return indicators;
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
  data = JSON.stringify(getScoreDataAJAXCall(location));

  locationValue = JSON.stringify(location);
  // zeroScoreData();
  setScoreData(data);
  show('mainpage', 'homepage');
  $('#community-snapshot-tab-link').trigger("click");
  setCompareData(data, 0);
  displayCompareData(JSON.parse(sessionStorage.getItem("compareCommunities")).length);
  $('#customize_location').html(location.county + " County, " + location.state);
  hwbi_disc_data = JSON.parse(data);

  //draw aster plot 
  drawPieChart(hwbi_disc_data.outputs.domains);


  // Set service slider values
  dragVal.services = hwbi_disc_data.outputs.services;
  for (var i = 0; i < hwbi_disc_data.outputs.services.length; i++) {
    var services = hwbi_disc_data.outputs.services;
    var $ele =  $('#' + services[i].name);
    var val = services[i].score;
    $ele.val(val);
    $ele.prev().html("<span>: " + round(val, 0) + "</span>");
  }



  setIndicatorSliders();
  hwbi_indicator_value_adjusted = {};
  setCookie('EPAHWBIDISC', location_data, 0.5);
  $('html, body').animate({
      //scrollTop: $('#disc-tabs').offset().top
  }, 'slow');
}

// Service listeners
$('.thumb').on('change', function() {
  console.log("change");
  var ele = $(this);
  var val = ele.val();
  for (var i = 0; i < dragVal.services.length; i++) {
    if (dragVal.services[i].name === ele.attr('id')) {
      dragVal.services[i].score = +val;
    }
  }
});
$('.thumb').on('input', function() {
  var $ele = $(this);
  var val = $ele.val();
  $ele.prev().html("<span>: " + round(val, 0) + "</span>");
});



function getScoreDataAJAXCall(location){
  var data = {};
  data.outputs = getIndicatorsForCounty(location.state_abbr, location.county);

  hwbi_indicator_data = formatIndicatorData(setIndicatorData(JSON.stringify(data)));

  data = formatDomainData(data);
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
  return services;
}

function get_domain_scores_national(){
  var scores = [];
  // Old Database
  // var stmt = db.prepare("Select * from Domains_National");
  // while (stmt.step()) {
  //   var row = stmt.get()
  //   scores.push(row);
  // } 
  return scores;
}

function get_domain_scores_state(state = ''){
  if (state === '') {
    return [];
  }
  var scores = [];
  // Old Database
  // var stmt = db.prepare("Select * from Domains_State where state=?");
  // stmt.bind([state]);
  // while (stmt.step()) {
  //   var row = stmt.get();
  //   scores.push(row);
  // }
  return scores;
}

function get_state_details(state = ''){
  if (state === '') {
    return [];
  }
  var scores = [];
  var stmt = db.prepare("Select * from States where state =?");
  stmt.bind([state]);
  while (stmt.step()) {
    var row = stmt.get()
    scores = row;
  }
  return scores;
}

function get_domains() {
    var domains = []
    var stmt = db.prepare("Select * from Domains");
    while (stmt.step()) {
      var row = stmt.get()
      domains.push(row);
    }
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

  var stmt = db.prepare("SELECT Indicators.indicator, CountyIndicatorScores.score, Counties.stateID " +
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
  return indicators;
}

function getIndicatorsForCounty(state = "", county = ""){
  if (state === "" || county === "") {
    return {};
  }
  var indicators = [];

  var stmt = db.prepare("SELECT Indicators.indicator, CountyIndicatorScores.score, CountyIndicatorScores.countyFIPS, Counties.county, Counties.stateID " +
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
  return indicators;
}
