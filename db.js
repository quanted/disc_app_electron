const electron = require('electron');
const { ipcRenderer, shell } = electron;
const { app, dialog, BrowserWindow } = electron.remote

const path = require('path');
const fs = require('fs');

try {
	var sqlite3 = require('sqlite3');
} catch (e) { 
  console.log(e);
  try {
    var sqlite3 = require(path.join(process.resourcesPath, '/app.asar/node_modules/sqlite3'));
  } catch (e) { 
    console.log(e);
  }
}

try {
  d3.tip = require('d3-tip');
} catch (e) {
  console.log(e);
  try {
    d3.tip = require(path.join(process.resourcesPath, '/app.asar/node_modules/d3-tip'));
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
  getNationalDomainScores();

  navigator.onLine ? onlineSearch(true) : onlineSearch(false);

  $('.version').html(`beta version ${app.getVersion()}`);
});

//open links externally by default
$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault();
    shell.openExternal(this.href.trim());
});

function generateReport() {
  document.body.style.cursor='progress';
  $('#report_pdf').attr('disabled', true);
  let chkbx = $('.resources-checkbox:checked');

  if (!chkbx.length) {
    const choice = dialog.showMessageBoxSync({
      type: 'question',
      buttons: ['Yes', 'No'],
      title: 'Generate Report',
      message: 'You have not selected any resources.\n\nDo you still want to generate a report?'
    });
  
    if (choice !== 0) { 
      $('#report_pdf').attr('disabled', false);
      document.body.style.cursor='default';
      return;
    }
  }

  $('.active-metric').trigger('click');

  for (let a = 0; a < chkbx.length; a++) {
    let grandparent = $(chkbx[a]).parent().parent().parent().prev('.accordion-metrics');
    let greatGrandparent = $(chkbx[a]).parent().parent().parent().parent().prev('.accordion-metrics');

    if (!$(grandparent).hasClass('active-metric')) {
      $(grandparent).trigger('click');
    }
    if (!$(greatGrandparent).hasClass('active-metric')) {
      $(greatGrandparent).trigger('click');
    }
  }
  ipcRenderer.send('print-to-pdf');
}

ipcRenderer.on('wrote-pdf', function() {
  $('#report_pdf').attr('disabled', false);
  document.body.style.cursor='default';
});

ipcRenderer.on('toggleSearch', function() {

  $('#statecounty').toggle();
  $('.autocomplete-container').toggle();

  $('#mainpage-statecounty').toggleClass('offline-active');
  $('#mainpage-statecounty').toggle();
  
  $('.search').toggle();
});

function generateSnapshot(that) {
  document.body.style.cursor='progress';
  $(that).attr('disabled', true);
  var domainData = {
    HWBI_DOMAIN: {},
    Service: {},
    DISC: {},
      National_DOMAIN: {},
      State_DOMAIN: {},
    National_DISC: {},
      State_DISC: {},
    location: '',
    dataChanged: false
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
  if (isCustomized()) {
    domainData.dataChanged = true
  }
  domainData.DISC.score = $('#wellbeing-score').html() / 100;
  domainData.location = $('#location').html();
  domainData.locationScores = $('#wellbeing-score-location').html();
  ipcRenderer.send('snap', domainData);
}

/**
 * Listen for has-been-saved from main process. Displays toast with save file location.
 * @param {event} event - The event.
 * @param {string} arg - A string containing the location of the save file.
 * @listens has-been-saved
 */
ipcRenderer.on('snapshot-opened', () => {
  $('#snapshot-btn').attr('disabled', false);
  document.body.style.cursor='default';
});

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

const db = new sqlite3.Database(dbPath);

if (fs.existsSync(path.join(__dirname, '/hwbi_app/cities.db'))) {
  dbPath = path.join(__dirname, "/hwbi_app/cities.db");
} else if (fs.existsSync(path.join(__dirname, '/resources/app/hwbi_app/cities.db'))) {
  dbPath = path.join(__dirname, "/resources/app/hwbi_app/cities.db");
} else if (fs.existsSync(path.join(process.resourcesPath, '/hwbi_app/cities.db'))) {
  dbPath = path.join(process.resourcesPath, '/hwbi_app/cities.db');
} else {
  console.log("cities - Database not found.")
}

const citiesDb = new sqlite3.Database(dbPath);

function setScoreData(state, county, valueType) {
  document.getElementById('score_indicator_span').style.transform = "rotate(0deg) skew(45deg, -45deg)";
  
  $('#location').html("Snapshot results for<br>" + county + ", " + state); // Set location info
  $('#reportlocation').html("Report for " + county + ", " + state);

  let num = 0;
  let denom = 0;
  Object.values(dataStructure.HWBI_DOMAIN).forEach((domain) => {
    if (domain[valueType]) {
      num += domain[valueType] * domain.weight;
      denom += domain.weight;
    }
  });
  let HWBI_score = round(num / denom * 100, 1);
  if (HWBI_score > 100) {
    HWBI_score = 100;
  } else if (HWBI_score < 0) {
    HWBI_score = 0;
  }
  $('#wellbeing-score').html(HWBI_score);
  $('.modal-disc-score span').html(HWBI_score);

  document.getElementById('score_indicator_span').style.transform = "rotate(" + Math.round(HWBI_score * 90 / 50) + "deg) skew(45deg, -45deg)"; // set the graphic
  $('#report-wellbeing-score').html(HWBI_score);

  // Display HWBI scores on Customize tabs
  for (const domain in dataStructure.HWBI_DOMAIN) { // Set Domain scores
    const slugifiedDomain = slugify(dataStructure.HWBI_DOMAIN[domain].name);
    const rawVal = dataStructure.HWBI_DOMAIN[domain][valueType];
    if (rawVal !== null) {
      const score = round(rawVal * 100, 1);
      $('#' + slugifiedDomain + '_score, #' + slugifiedDomain + '_modal_score').html(score).prop('title', '').css('cursor', 'pointer');
      $('#' + slugifiedDomain + '_score_bar').attr('data-percent', score + "%");
      $('#' + slugifiedDomain + '_score_summary').html(score);
    } else {
      const score = "N/A";
      $('#' + slugifiedDomain + '_score, #' + slugifiedDomain + '_modal_score').html(score).prop('title', 'Score could not be calculated due to lack of available data.').css('cursor', 'help');
      $('#' + slugifiedDomain + '_score_bar').attr('data-percent', "0%");
      $('#' + slugifiedDomain + '_score_summary').html(score);
    }
  }

  for (const indicator in dataStructure.HWBI_INDICATOR) { // Set indicator scores
    const slugifiedIndicator = slugify(dataStructure.HWBI_INDICATOR[indicator].parent.name) + "_" + slugify(dataStructure.HWBI_INDICATOR[indicator].name);
    const rawVal = dataStructure.HWBI_INDICATOR[indicator][valueType];
    let score = round(rawVal * 100, 1);
    if (rawVal === null) {
      score = 'N/A';
      $('#' + slugifiedIndicator + "_value").parent().prop('title', 'Score could not be calculated due to lack of available data.').css('cursor', 'help');
    } else {
      $('#' + slugifiedIndicator + "_value").parent().prop('title', '').css('cursor', 'pointer');
    }
    $('#' + slugifiedIndicator + "_value").html(score);
  }

  resetServiceScores(valueType);
}

function resetServiceScores(valueType) {
  // Display Service scores on Customize tabs
  for (const domain in dataStructure.METRIC_GROUP) { // Set Service METRIC_GROUP scores
    const metricGroup = dataStructure.METRIC_GROUP[domain];
    if (metricGroup.name !== 'HWBI') {
      const slugifiedDomain = slugify(metricGroup.name);
      const rawVal = metricGroup[valueType];
      let score = round(rawVal * 100, 1);
      if (rawVal === null) {
        score = "N/A";
      }
      $('#' + slugifiedDomain + '_score, #' + slugifiedDomain + '_modal_score').html(score);
    }
  }

  for (const domain in dataStructure.SERVICE_DOMAIN) { // Set Service Domain scores
    const slugifiedDomain = slugify(dataStructure.SERVICE_DOMAIN[domain].parent.name) + "_" + slugify(dataStructure.SERVICE_DOMAIN[domain].name);
    const rawVal = dataStructure.SERVICE_DOMAIN[domain][valueType];
    let score = round(rawVal * 100, 1);
    if (rawVal === null) {
      score = "N/A";
      $('#' + slugifiedDomain + "_value").parent().prop('title', 'Score could not be calculated due to lack of available data.').css('cursor', 'help');
    } else {
      $('#' + slugifiedDomain + "_value").parent().prop('title', '').css('cursor', 'pointer');
    }
    $('#' + slugifiedDomain + "_value").html(score);
  }

  for (const indicator in dataStructure.SERVICE_INDICATOR) { // Set Service Indicator scores
    const slugifiedIndicator = slugify(dataStructure.SERVICE_INDICATOR[indicator].parent.name) + "_" + slugify(dataStructure.SERVICE_INDICATOR[indicator].name);
    const rawVal = dataStructure.SERVICE_INDICATOR[indicator][valueType];
    let score = round(rawVal * 100, 1);
    if (rawVal === null) {
      score = "N/A";
      $('#' + slugifiedIndicator + "_value").parent().prop('title', 'Score could not be calculated due to lack of available data.').css('cursor', 'help');
    } else {
      $('#' + slugifiedIndicator + "_value").parent().prop('title', '').css('cursor', 'pointer');
    }
    $('#' + slugifiedIndicator + "_value").html(score);
  }

  toggleCustomizedDataMessage();
}

let isClicked = false;
$('.tutButton').click(function(e) {

  isClicked = true;
});

let searchCount = 0;
async function getScoreData() {
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
  resetRivs();
  initializeRankingDonut();
  getStateDomainScores(location.state_abbr);

  let rows = await getMetricsForCounty(location.county, location.state_abbr);
  
  rows.forEach((row) => {
    const elements = document.querySelectorAll('[data-var="' + row.METRIC_VAR + '"]');

    if (elements.length) {
      elements.forEach(element => {
        element.parentElement.title = element.parentElement.dataset.title + row.VINTAGE + ').';

        if (row.SCORE === null) {
          element.value = 0;
          element.dataset.isNull = true;
        } else {
          element.value = row.SCORE;
          element.dataset.isNull = false;
        }

        updateSliderLabel(element);
      });
    } else {
      console.log(row.METRIC_VAR)
      console.log(elements)
    }

    if (row.METRIC_GRP === 'HWBI' || row.METRIC_GRP === 'CRSI') {
      metricType = "HWBI_METRIC";
    } else if (row.METRIC_GRP === 'Economic' || row.METRIC_GRP === 'Social' || row.METRIC_GRP === 'Ecosystem') {
      metricType = "SERVICE_METRIC";
    }
    dataStructure[metricType][row.METRIC_VAR].pos_neg = row.POS_NEG_METRIC; // add the metric score to the data structure
    dataStructure[metricType][row.METRIC_VAR].original_val = row.SCORE; // add the metric score to the data structure
    dataStructure[metricType][row.METRIC_VAR].custom_val = row.SCORE; // add the metric score to the data structure
    dataStructure[metricType][row.METRIC_VAR].scenario_val = row.SCORE; // add the metric score to the data structure
  });
 
  setAllInitialAvgValues('SERVICE_INDICATOR', dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
  setAllInitialAvgValues('SERVICE_DOMAIN', dataStructure); // calculate the domain scores by averaging each domain's child indicators

  setAllInitialAvgValues('HWBI_INDICATOR', dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
  setAllInitialAvgValues('HWBI_DOMAIN', dataStructure); // calculate the domain scores by averaging each domain's child indicators

  setAllInitialAvgValues('METRIC_GROUP', dataStructure); // calculate the domain scores by averaging each domain's child indicators
  setAllInitialWeightedAvgValues('METRIC_GROUP', dataStructure); // calculate the metric group scores by averaging each metric group's child domains

  // fix slider inital values quickly...
  resetServices();
  resetDomains();
  resetValues(dataStructure.METRIC_GROUP['Economic'], 'scenario_val', 'original_val');
  resetValues(dataStructure.METRIC_GROUP['Ecosystem'], 'scenario_val', 'original_val');
  resetValues(dataStructure.METRIC_GROUP['Social'], 'scenario_val', 'original_val');
  resetDomainSliders(dataStructure.SERVICE_DOMAIN, 'scenario_val', 'scenario-builder-domain');

  setScoreData(location.state, location.county, "original_val"); // set the domain scores

  // set data for compare map
  comp_setCompareMapData(location.state_abbr, location.county);

  updateApexCharts('original_val');

  loadSkillbar(); // update the colored bars on the snapshot page
  runAsterPlot(); //draw aster plot

  $('.preload').fadeOut();
  $('.preload-wrapper').delay(350).fadeOut('slow');

  locationValue = JSON.stringify(location);
  show('mainpage', 'homepage');
  $('#community-snapshot-tab-link').trigger("click");
  
  $('#customize_location').html(location.county + ", " + location.state);
  setCookie('EPAHWBIDISC', location_data, 0.5);

  //if tutorial button clicked, start tutorial
  if(isClicked) {
    startIntro();
    isClicked = false;
  } else {
    return;
  }
  

}



/**
 * Change the relative importance weight of a domain
 * @listens change
 */
$('.rankinglist input').on("input", function() {
  const $this = $(this)
  const label = $this.attr('data-did');

  dataStructure.HWBI_DOMAIN[label].weight = +$this.val();

  updateRivUi();
  toggleCustomizedDataMessage();
});

/**
 * Change the HWBI metric values, update the indicators, domains, and the domains on the snapshot page snapshot
 * @listens change
 */
$('.customize-hwbi-metrics').on('change', function() { // customize metric listeners
  const ele = this;
  const val = +ele.value;
  const loc = JSON.parse(locationValue);
  const state = loc.state_abbr;
  const county = loc.county;
  const metric = dataStructure.HWBI_METRIC[ele.dataset.var];
  
  metric.custom_val = val;

  updateAllAvgValues('HWBI_INDICATOR', 'custom_val', dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
  updateAllAvgValues('HWBI_DOMAIN', 'custom_val', dataStructure); // calculate the domain scores by averaging each domain's child indicators

  updateAllWeightedAvgValues('METRIC_GROUP', 'custom_val', dataStructure); // calculate the metric group scores by averaging each metric group's child domains
  
  setScoreData(state, county, "custom_val"); // set the domain scores
  loadSkillbar(); // update the colored bars on the snapshot page

  // update the scenario builder scores
  calculateServiceHWBI();
  runAsterPlot();

  //add bullet service markers to hwbi metrics on change
  $(ele).parent().parent().parent().find('.accordion-metrics').addClass('bull');
  $(ele).closest('.card').children('a').find('.card-text-overlay').addClass('bull');
  $(ele).prev().addClass('bull');
  toggleCustomizedDataMessage();
});

/**
 * Change the HWBI metric values, update the indicators, domains, and the domains on the snapshot page snapshot
 * @listens change
 */
$('.customize-service-metrics').on('change', function() { // customize metric listeners
  const ele = this;
  const val = +ele.value;
  const metric = dataStructure.SERVICE_METRIC[ele.dataset.var];
  
  metric.custom_val = val;

  updateAllAvgValues('SERVICE_INDICATOR', 'custom_val', dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
  updateAllAvgValues('SERVICE_DOMAIN', 'custom_val', dataStructure); // calculate the domain scores by averaging each domain's child indicators
  updateAllAvgValues('METRIC_GROUP', 'custom_val', dataStructure); // calculate the metric group scores by averaging each metric group's child domains

  //setScoreData(state, county, "custom_val"); // set the domain scores
  resetServiceScores("custom_val");

  updateApexCharts("custom_val");

  //add bullet markers to services when changed
  let innerBtn = $(ele).parent().parent().parent().find('.accordion-metrics');
  let outerBtn = $(innerBtn).parent().parent().parent().children('button');

  $(innerBtn).addClass('bull');
  $(outerBtn).addClass('bull');
  $(ele).closest('.service-card').children('a').find('.card-text-overlay').addClass('bull');
  $(ele).prev().addClass('bull');
  toggleCustomizedDataMessage();
});

$('.scenario-builder-domain').on('change', function() { // customize metric listeners
  const ele = this;
  const val = +ele.value;
  const domain = dataStructure.SERVICE_DOMAIN[ele.dataset.domain];
  
  domain.scenario_val = val;

  // updateAllAvgValues('SERVICE_INDICATOR', 'scenario_val', dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
  // updateAllAvgValues('SERVICE_DOMAIN', 'scenario_val', dataStructure); // calculate the domain scores by averaging each domain's child indicators
  updateAllAvgValues('METRIC_GROUP', 'scenario_val', dataStructure); // calculate the metric group scores by averaging each metric group's child domains
  calculateServiceHWBI();
  runAsterPlot();
  toggleCustomizedDataMessage();
});

$('.scenario-builder-domain').on('input', function() { // customize metric listeners
  const ele = this;
  ele.previousElementSibling.innerHTML = "<span> " + round(ele.value * 100, 0) + "</span>";
});

// Update the slider labels when an input is triggered
$('.thumb').on('input', function() {
  const ele = this;
  ele.dataset.isNull = false;
  updateSliderLabel(ele);
});

function getMetricsForCounty(county = "", state = "") {
  let sql = "SELECT  MetricVars.METRIC_VAR, " +
                    "MetricVarScores.SCORE, " +
                    "Counties.COUNTY_NAME, " +
                    "Counties.STATE_CODE, " +
                    "MetricGroups_Domains.METRIC_GRP, " +
                    "MetricVars.MINVAL, " +
                    "MetricVars.MAXVAL, " +
                    "MetricVars.POS_NEG_METRIC, " +
                    "MetricVars.UNITS, " +
                    "MetricVars.METRIC_VAR, " +
                    "MetricGroups_Domains.METRIC_GRP as METRIC_GRP, " +
                    "MetricVarScores.VINTAGE " +
  "FROM MetricVarScores " +
  "INNER JOIN Counties ON MetricVarScores.FIPS == Counties.FIPS " +
  "INNER JOIN MetricVars ON MetricVarScores.METRIC_VAR == MetricVars.METRIC_VAR " +
  "INNER JOIN Indicators_MetricVars ON Indicators_MetricVars.METRIC_VAR == MetricVars.METRIC_VAR " +
  "INNER JOIN Domains_Indicators ON Domains_Indicators.INDICATOR == Indicators_MetricVars.INDICATOR " +
  "INNER JOIN MetricGroups_Domains ON MetricGroups_Domains.DOMAIN == Domains_Indicators.DOMAIN " +
  "WHERE Counties.COUNTY_NAME ==? AND Counties.STATE_CODE ==?";

  return new Promise( ( resolve, reject ) => {
    db.all(sql, [county, state], (err, rows) => {
        if (err) {
            console.log('Error - getMetricsForCounty(' + county + ', ' + state + '): ' + err);
            reject(err);
        }
        resolve(rows);
    });
  });
}

function createDataStructure(obj) {
  var sql = "SELECT MetricGroups_Domains.METRIC_GRP as METRIC_GROUP, Domains_Indicators.DOMAIN AS DOMAIN, Indicators_MetricVars.INDICATOR as INDICATOR, MetricVars.METRIC_VAR " +
  "FROM MetricVars " +
  "INNER JOIN Indicators_MetricVars ON Indicators_MetricVars.METRIC_VAR == MetricVars.METRIC_VAR " +
  "INNER JOIN Domains_Indicators ON Indicators_MetricVars.INDICATOR == Domains_Indicators.INDICATOR " + 
  "INNER JOIN MetricGroups_Domains ON MetricGroups_Domains.DOMAIN == Domains_Indicators.DOMAIN;";

  db.all(sql, [], (err, rows) => {
    if (err) {
      throw err;
    }
    rows.forEach((row) => {

      // Create MetricGroup if it doesn't exist
      if (!obj.METRIC_GROUP.hasOwnProperty(row.METRIC_GROUP)) {
        obj.METRIC_GROUP[row.METRIC_GROUP] = new Node(row.METRIC_GROUP, [], 0, 0, 0, null, "METRIC_GROUP", row.METRIC_GROUP);
      }

      if (row.METRIC_GROUP === 'HWBI' || row.METRIC_GROUP === 'CRSI') { // HWBI and CRSI MetricGroup
        // Create HWBI Domain if it doesn't exist
        if (!obj.HWBI_DOMAIN.hasOwnProperty(row.DOMAIN)) {
          obj.HWBI_DOMAIN[row.DOMAIN] = new Node(row.DOMAIN, [], 0, 0, 0, obj.METRIC_GROUP[row.METRIC_GROUP], "HWBI_DOMAIN", row.DOMAIN);
        }
        // Create HWBI Indicator if it doesn't exist
        if (!obj.HWBI_INDICATOR.hasOwnProperty(row.DOMAIN + '_' + row.INDICATOR)) {
          obj.HWBI_INDICATOR[row.DOMAIN + '_' + row.INDICATOR] = new Node(row.INDICATOR, [], 0, 0, 0, obj.HWBI_DOMAIN[row.DOMAIN], "HWBI_INDICATOR", row.DOMAIN + '_' + row.INDICATOR);
        }
        // Create HWBI Metric if it doesn't exist
        if (!obj.HWBI_METRIC.hasOwnProperty(row.METRIC_VAR)) {
          obj.HWBI_METRIC[row.METRIC_VAR] = new Node(row.METRIC_VAR, [], 0, 0, 0, obj.HWBI_INDICATOR[row.DOMAIN + '_' + row.INDICATOR], "HWBI_METRIC", row.METRIC_VAR);
        }
        // Create HWBI Metric Group child if it doesn't exist
        if (obj.METRIC_GROUP[row.METRIC_GROUP].children.indexOf(obj.HWBI_DOMAIN[row.DOMAIN]) < 0) {
          obj.METRIC_GROUP[row.METRIC_GROUP].children.push(obj.HWBI_DOMAIN[row.DOMAIN]);
        }
        // Create HWBI Domain child if it doesn't exist
        if (obj.HWBI_DOMAIN[row.DOMAIN].children.indexOf(obj.HWBI_INDICATOR[row.DOMAIN + '_' + row.INDICATOR]) < 0) {
          obj.HWBI_DOMAIN[row.DOMAIN].children.push(obj.HWBI_INDICATOR[row.DOMAIN + '_' + row.INDICATOR]);
        }
        // Create HWBI Indicator child if it doesn't exist
        if (obj.HWBI_INDICATOR[row.DOMAIN + '_' + row.INDICATOR].children.indexOf(obj.HWBI_METRIC[row.METRIC_VAR]) < 0) {
          obj.HWBI_INDICATOR[row.DOMAIN + '_' + row.INDICATOR].children.push(obj.HWBI_METRIC[row.METRIC_VAR]);
        }
      } else if (row.METRIC_GROUP === 'Economic' || row.METRIC_GROUP === 'Ecosystem' || row.METRIC_GROUP === 'Social') { // Economic, Ecosystem, Social MetricGroups
        if (!obj.SERVICE_DOMAIN.hasOwnProperty(row.DOMAIN)) {
          obj.SERVICE_DOMAIN[row.DOMAIN] = new Node(row.DOMAIN, [], 0, 0, 0, obj.METRIC_GROUP[row.METRIC_GROUP], "SERVICE_DOMAIN", row.DOMAIN);
        }
        if (!obj.SERVICE_INDICATOR.hasOwnProperty(row.DOMAIN + '_' + row.INDICATOR)) {
          obj.SERVICE_INDICATOR[row.DOMAIN + '_' + row.INDICATOR] = new Node(row.INDICATOR, [], 0, 0, 0, obj.SERVICE_DOMAIN[row.DOMAIN], "SERVICE_INDICATOR", row.DOMAIN + '_' + row.INDICATOR);
        }
        if (!obj.SERVICE_METRIC.hasOwnProperty(row.METRIC_VAR)) {
          obj.SERVICE_METRIC[row.METRIC_VAR] = new Node(row.METRIC_VAR, [], 0, 0, 0, obj.SERVICE_INDICATOR[row.DOMAIN + '_' + row.INDICATOR], "SERVICE_METRIC", row.METRIC_VAR);
        }
        if (obj.METRIC_GROUP[row.METRIC_GROUP].children.indexOf(obj.SERVICE_DOMAIN[row.DOMAIN]) < 0) {
          obj.METRIC_GROUP[row.METRIC_GROUP].children.push(obj.SERVICE_DOMAIN[row.DOMAIN]);
        }
        if (obj.SERVICE_DOMAIN[row.DOMAIN].children.indexOf(obj.SERVICE_INDICATOR[row.DOMAIN + '_' + row.INDICATOR]) < 0) {
          obj.SERVICE_DOMAIN[row.DOMAIN].children.push(obj.SERVICE_INDICATOR[row.DOMAIN + '_' + row.INDICATOR]);
        }
        if (obj.SERVICE_INDICATOR[row.DOMAIN + '_' + row.INDICATOR].children.indexOf(obj.SERVICE_METRIC[row.METRIC_VAR]) < 0) {
          obj.SERVICE_INDICATOR[row.DOMAIN + '_' + row.INDICATOR].children.push(obj.SERVICE_METRIC[row.METRIC_VAR]);
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
  const sum = function (items, prop) {
    return items.reduce( function(a, b) {
      return a + b[prop];
    }, 0);
  };
  for (const indicator in obj[thing]) {
    let number = 0; 
    obj[thing][indicator].children.forEach(child => {
      if (child[value] !== null) {
        number += 1;
      }
    });
    let avg = sum(obj[thing][indicator].children, value) / number;
    if (Number.isNaN(avg)) {
      avg = null;
    }
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
	for (const indicator in obj[thing]) {
    const sum = function (items, prop) {
      return items.reduce( function(a, b) {
        return a + b[prop];
      }, 0);
    };

    var number = 0; 

    obj[thing][indicator].children.forEach(child => {
      if (child.original_val !== null) {
        number += 1;
      }
    });

    let avg = sum(obj[thing][indicator].children, 'original_val') / number;
    if (Number.isNaN(avg)) {
      avg = null;
    }
    obj[thing][indicator].original_val = avg;
    obj[thing][indicator].custom_val = avg;
    obj[thing][indicator].scenario_val = avg;
  }
}

function setAllInitialWeightedAvgValues(thing, obj) {
	for (const indicator in obj[thing]) {
    if (obj[thing][indicator].children[0].hasOwnProperty('weight')) {
      const sum = function (items, prop) {
        return items.reduce( function(a, b) {
          return a + b[prop];
        }, 0);
      };

      const weightedSum = function (items, prop) {
        return items.reduce( function(a, b) {
          return a + b[prop] * b.weight;
        }, 0);
      };

      const avg = weightedSum(obj[thing][indicator].children, 'original_val') / sum(obj[thing][indicator].children, 'weight');

      obj[thing][indicator].original_val = avg;
      obj[thing][indicator].custom_val = avg;
      obj[thing][indicator].scenario_val = avg;
    }
  }
}

function runAsterPlot() {
  const asterData = [];
  for (const domain in dataStructure.HWBI_DOMAIN) {
    if (domain !== "Resilience") {
      var val = (dataStructure.HWBI_DOMAIN[domain].scenario_val - dataStructure.HWBI_DOMAIN[domain].original_val) * 100;
      asterData.push({
        description: dataStructure.HWBI_DOMAIN[domain].name,
        weight: dataStructure.HWBI_DOMAIN[domain].weight,
        score: ((dataStructure.HWBI_DOMAIN[domain].scenario_val - dataStructure.HWBI_DOMAIN[domain].original_val) * 100 > 0 ? (dataStructure.HWBI_DOMAIN[domain].scenario_val - dataStructure.HWBI_DOMAIN[domain].original_val) * 100 : 0),
      });
    }
  }
  if (!drawn) {
    drawAsterPlot(asterData);
  } else {
    updateAsterPlot(asterData);
  }
}

function getStateDomainScores(state) {
  var sql = `SELECT DOMAIN, avg(SCORE) as SCORE from(
    SELECT Domains_Indicators.DOMAIN, Indicators_MetricVars.INDICATOR, avg(MetricVarScores.SCORE) as SCORE
      FROM MetricVarScores
      INNER JOIN Counties ON MetricVarScores.FIPS == Counties.FIPS
      INNER JOIN MetricVars ON MetricVarScores.METRIC_VAR == MetricVars.METRIC_VAR
      INNER JOIN Indicators_MetricVars ON Indicators_MetricVars.METRIC_VAR == MetricVars.METRIC_VAR
      INNER JOIN Domains_Indicators ON Domains_Indicators.INDICATOR == Indicators_MetricVars.INDICATOR
      INNER JOIN MetricGroups_Domains ON MetricGroups_Domains.DOMAIN == Domains_Indicators.DOMAIN
      WHERE Counties.STATE_CODE ==? AND (MetricGroups_Domains.METRIC_GRP='HWBI' OR MetricGroups_Domains.METRIC_GRP='CRSI')
      Group By Domains_Indicators.DOMAIN, Indicators_MetricVars.INDICATOR) Group By DOMAIN`;
  db.all(sql, [state], (err, rows) => {
    if (err) {
      throw err;
    }
    let avg = 0;
    rows.forEach((row) => {
      $("#" + slugify(row.DOMAIN) + "_state_score").html(round(row.SCORE * 100, 1));
      avg += row.SCORE;
    });
    $("#disc_state_score").html(round(avg / rows.length * 100, 1));
  });
}

function getNationalDomainScores() {
  var sql = `SELECT DOMAIN, avg(SCORE) as SCORE from(
    SELECT Domains_Indicators.DOMAIN, Indicators_MetricVars.INDICATOR, avg(MetricVarScores.SCORE) as SCORE
      FROM MetricVarScores
      INNER JOIN Counties ON MetricVarScores.FIPS == Counties.FIPS
      INNER JOIN MetricVars ON MetricVarScores.METRIC_VAR == MetricVars.METRIC_VAR
      INNER JOIN Indicators_MetricVars ON Indicators_MetricVars.METRIC_VAR == MetricVars.METRIC_VAR
      INNER JOIN Domains_Indicators ON Domains_Indicators.INDICATOR == Indicators_MetricVars.INDICATOR
      INNER JOIN MetricGroups_Domains ON MetricGroups_Domains.DOMAIN == Domains_Indicators.DOMAIN
      WHERE MetricGroups_Domains.METRIC_GRP='HWBI' OR MetricGroups_Domains.METRIC_GRP='CRSI'
      Group By Domains_Indicators.DOMAIN, Indicators_MetricVars.INDICATOR) Group By DOMAIN`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      throw err;
    }
    let avg = 0;
    rows.forEach((row) => {
      $("#" + slugify(row.DOMAIN) + "_national_score").html(round(row.SCORE * 100, 1));
      avg += row.SCORE;
    });
    $("#disc_national_score").html(round(avg / rows.length * 100, 1));
  });
}

function getStateCode(location) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT STATE_CODE FROM COUNTIES WHERE COUNTY_NAME=? AND STATE_NAME=?`, location, (err, row) => {
        if (err) {
            console.log('Error - getStateCode(' + location[0] + ', ' + location[1] + '): ' + err);
            reject(err);
        }
        resolve(row);
    });
  });
}

function getCounty(location) {
  let city = location[0];
  let state = location[1];
  let sql = `SELECT COUNTY_NAME, STATE_CODE
    FROM Cities
    WHERE CITY_NAME ==? AND STATE_NAME ==?`;

  return new Promise((resolve, reject) => {
    citiesDb.all(sql, [city, state], (err, rows) => {
        if (err) {
            console.log('Error - getCounty(' + city + ', ' + state + '): ' + err);
            reject(err);
        }
        resolve(rows);
    });
    //citiesDb.close();
  });
}

function slugify(string) {
  return string.replace(/ /g, '-').replace(/[^0-9a-z-_]/gi, '').toLowerCase().trim();
}

function calculateServiceHWBI(valueType = 'custom_val') {
  const key = {
    S01:	"Capital Investment",
    S02:	"Consumption",
    S03:	"Employment",
    S04:	"Finance",
    S05:	"Innovation",
    S06:	"Production",
    S07:	"Re-Distribution",
    S08:	"Air Quality",
    S09:	"Food, Fiber and Fuel Provisioning",
    S10:	"Greenspace",
    S11:	"Land Quality",
    S12:	"Water Quality",
    S13:	"Water Quantity",
    S14:	"Activism",
    S15:	"Communication",
    S16:	"Community and Faith-Based Initiatives",
    S17:	"Emergency Preparedness",
    S18:	"Family Services",
    S19:	"Healthcare",
    S20:	"Housing",
    S21:	"Justice",
    S22:	"Labor",
    S23:	"Public Education",
    S24:	"Public Works",
    S25:	"Transportation",
  };

  let val;

  val = dataStructure.HWBI_DOMAIN["Connection to Nature"][valueType] +
    (2.125496 + 
      dataStructure.SERVICE_DOMAIN[key.S03].scenario_val * 4.983393 +
      dataStructure.SERVICE_DOMAIN[key.S08].scenario_val * -4.639731 +
      dataStructure.SERVICE_DOMAIN[key.S15].scenario_val * -0.331266 +
      dataStructure.SERVICE_DOMAIN[key.S18].scenario_val * -1.085891 +
      dataStructure.SERVICE_DOMAIN[key.S21].scenario_val * 0.487747 +
      dataStructure.SERVICE_DOMAIN[key.S14].scenario_val * -9.83217 +
      dataStructure.SERVICE_DOMAIN[key.S07].scenario_val * 0.127427 +
      dataStructure.SERVICE_DOMAIN[key.S03].scenario_val * dataStructure.SERVICE_DOMAIN[key.S18].scenario_val * -13.18771 +
      dataStructure.SERVICE_DOMAIN[key.S08].scenario_val * dataStructure.SERVICE_DOMAIN[key.S18].scenario_val * 10.840124 +
      dataStructure.SERVICE_DOMAIN[key.S04].scenario_val * dataStructure.SERVICE_DOMAIN[key.S19].scenario_val * 0.45075) -
    (2.125496 +
      dataStructure.SERVICE_DOMAIN[key.S03][valueType] * 4.983393 +
      dataStructure.SERVICE_DOMAIN[key.S08][valueType] * -4.639731 +
      dataStructure.SERVICE_DOMAIN[key.S15][valueType] * -0.331266 +
      dataStructure.SERVICE_DOMAIN[key.S18][valueType] * -1.085891 +
      dataStructure.SERVICE_DOMAIN[key.S21][valueType] * 0.487747 +
      dataStructure.SERVICE_DOMAIN[key.S14][valueType] * -9.83217 +
      dataStructure.SERVICE_DOMAIN[key.S07][valueType] * 0.127427 +
      dataStructure.SERVICE_DOMAIN[key.S03][valueType] * dataStructure.SERVICE_DOMAIN[key.S18][valueType] * -13.18771 +
      dataStructure.SERVICE_DOMAIN[key.S08][valueType] * dataStructure.SERVICE_DOMAIN[key.S18][valueType] * 10.840124 +
      dataStructure.SERVICE_DOMAIN[key.S04][valueType] * dataStructure.SERVICE_DOMAIN[key.S19][valueType] * 0.45075);
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["Connection to Nature"].scenario_val = val;

  val = dataStructure.HWBI_DOMAIN["Cultural Fulfillment"][valueType] +
    (1.241511 +
      dataStructure.SERVICE_DOMAIN[key.S03].scenario_val * 1.606393 +
      dataStructure.SERVICE_DOMAIN[key.S12].scenario_val * -0.437157 +
      dataStructure.SERVICE_DOMAIN[key.S21].scenario_val * -0.409964 +
      dataStructure.SERVICE_DOMAIN[key.S18].scenario_val * -0.42666 +
      dataStructure.SERVICE_DOMAIN[key.S20].scenario_val * -0.992387 +
      dataStructure.SERVICE_DOMAIN[key.S07].scenario_val * -2.899043 +
      dataStructure.SERVICE_DOMAIN[key.S02].scenario_val * 0.227824 +
      dataStructure.SERVICE_DOMAIN[key.S04].scenario_val * -0.197434 +
      dataStructure.SERVICE_DOMAIN[key.S03].scenario_val * dataStructure.SERVICE_DOMAIN[key.S12].scenario_val * -2.331611 +
      dataStructure.SERVICE_DOMAIN[key.S20].scenario_val * dataStructure.SERVICE_DOMAIN[key.S07].scenario_val * 2.679329 +
      dataStructure.SERVICE_DOMAIN[key.S08].scenario_val * dataStructure.SERVICE_DOMAIN[key.S24].scenario_val * 0.263944 +
      dataStructure.SERVICE_DOMAIN[key.S12].scenario_val * dataStructure.SERVICE_DOMAIN[key.S07].scenario_val * 3.115341 +
      dataStructure.SERVICE_DOMAIN[key.S11].scenario_val * dataStructure.SERVICE_DOMAIN[key.S17].scenario_val * 0.12478) -
    (1.241511 +
      dataStructure.SERVICE_DOMAIN[key.S03][valueType] * 1.606393 +
      dataStructure.SERVICE_DOMAIN[key.S12][valueType] * -0.437157 +
      dataStructure.SERVICE_DOMAIN[key.S21][valueType] * -0.409964 +
      dataStructure.SERVICE_DOMAIN[key.S18][valueType] * -0.42666 +
      dataStructure.SERVICE_DOMAIN[key.S20][valueType] * -0.992387 +
      dataStructure.SERVICE_DOMAIN[key.S07][valueType] * -2.899043 +
      dataStructure.SERVICE_DOMAIN[key.S02][valueType] * 0.227824 +
      dataStructure.SERVICE_DOMAIN[key.S04][valueType] * -0.197434 +
      dataStructure.SERVICE_DOMAIN[key.S03][valueType] * dataStructure.SERVICE_DOMAIN[key.S12][valueType] * -2.331611 +
      dataStructure.SERVICE_DOMAIN[key.S20][valueType] * dataStructure.SERVICE_DOMAIN[key.S07][valueType] * 2.679329 +
      dataStructure.SERVICE_DOMAIN[key.S08][valueType] * dataStructure.SERVICE_DOMAIN[key.S24][valueType] * 0.263944 +
      dataStructure.SERVICE_DOMAIN[key.S12][valueType] * dataStructure.SERVICE_DOMAIN[key.S07][valueType] * 3.115341 +
      dataStructure.SERVICE_DOMAIN[key.S11][valueType] * dataStructure.SERVICE_DOMAIN[key.S17][valueType] * 0.12478);
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["Cultural Fulfillment"].scenario_val = val; 

  val = dataStructure.HWBI_DOMAIN["Education"][valueType] +
    (0.317409 +
      dataStructure.SERVICE_DOMAIN[key.S08].scenario_val * 0.307336 +
      dataStructure.SERVICE_DOMAIN[key.S09].scenario_val * -0.031266 +
      dataStructure.SERVICE_DOMAIN[key.S05].scenario_val * 0.576819 +
      dataStructure.SERVICE_DOMAIN[key.S02].scenario_val * 0.087566 +
      dataStructure.SERVICE_DOMAIN[key.S07].scenario_val * -0.333649 +
      dataStructure.SERVICE_DOMAIN[key.S13].scenario_val * -0.243361 +
      dataStructure.SERVICE_DOMAIN[key.S18].scenario_val * -1.313181 +
      dataStructure.SERVICE_DOMAIN[key.S21].scenario_val * -0.743381 +
      dataStructure.SERVICE_DOMAIN[key.S22].scenario_val * 0.249658 +
      dataStructure.SERVICE_DOMAIN[key.S14].scenario_val * 8.38291 +
      dataStructure.SERVICE_DOMAIN[key.S06].scenario_val * -0.196975 +
      dataStructure.SERVICE_DOMAIN[key.S03].scenario_val * dataStructure.SERVICE_DOMAIN[key.S24].scenario_val * -0.708485) -
    (0.317409 +
      dataStructure.SERVICE_DOMAIN[key.S08][valueType] * 0.307336 +
      dataStructure.SERVICE_DOMAIN[key.S09][valueType] * -0.031266 +
      dataStructure.SERVICE_DOMAIN[key.S05][valueType] * 0.576819 +
      dataStructure.SERVICE_DOMAIN[key.S02][valueType] * 0.087566 +
      dataStructure.SERVICE_DOMAIN[key.S07][valueType] * -0.333649 +
      dataStructure.SERVICE_DOMAIN[key.S13][valueType] * -0.243361 +
      dataStructure.SERVICE_DOMAIN[key.S18][valueType] * -1.313181 +
      dataStructure.SERVICE_DOMAIN[key.S21][valueType] * -0.743381 +
      dataStructure.SERVICE_DOMAIN[key.S22][valueType] * 0.249658 +
      dataStructure.SERVICE_DOMAIN[key.S14][valueType] * 8.38291 +
      dataStructure.SERVICE_DOMAIN[key.S06][valueType] * -0.196975 +
      dataStructure.SERVICE_DOMAIN[key.S03][valueType] * dataStructure.SERVICE_DOMAIN[key.S24][valueType] * -0.708485);
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["Education"].scenario_val = val; 

  val = dataStructure.HWBI_DOMAIN["Health"][valueType] +
    (0.499961 +
      dataStructure.SERVICE_DOMAIN[key.S19].scenario_val * 0.96139 +
      dataStructure.SERVICE_DOMAIN[key.S24].scenario_val * -0.634687 +
      dataStructure.SERVICE_DOMAIN[key.S20].scenario_val * 0.494802 +
      dataStructure.SERVICE_DOMAIN[key.S18].scenario_val * -0.300629 +
      dataStructure.SERVICE_DOMAIN[key.S04].scenario_val * 0.208537 +
      dataStructure.SERVICE_DOMAIN[key.S07].scenario_val * -0.137244 +
      dataStructure.SERVICE_DOMAIN[key.S06].scenario_val * dataStructure.SERVICE_DOMAIN[key.S22].scenario_val * -0.269267) -
    (0.499961 +
      dataStructure.SERVICE_DOMAIN[key.S19][valueType] * 0.96139 +
      dataStructure.SERVICE_DOMAIN[key.S24][valueType] * -0.634687 +
      dataStructure.SERVICE_DOMAIN[key.S20][valueType] * 0.494802 +
      dataStructure.SERVICE_DOMAIN[key.S18][valueType] * -0.300629 +
      dataStructure.SERVICE_DOMAIN[key.S04][valueType] * 0.208537 +
      dataStructure.SERVICE_DOMAIN[key.S07][valueType] * -0.137244 +
      dataStructure.SERVICE_DOMAIN[key.S06][valueType] * dataStructure.SERVICE_DOMAIN[key.S22][valueType] * -0.269267);
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["Health"].scenario_val = val;

  val = dataStructure.HWBI_DOMAIN["Leisure Time"][valueType] +
    (-0.952029 +
      dataStructure.SERVICE_DOMAIN[key.S16].scenario_val * 0.938554 +
      dataStructure.SERVICE_DOMAIN[key.S20].scenario_val * 0.186626 +
      dataStructure.SERVICE_DOMAIN[key.S15].scenario_val * 2.728191 +
      dataStructure.SERVICE_DOMAIN[key.S03].scenario_val * 2.2115 +
      dataStructure.SERVICE_DOMAIN[key.S02].scenario_val * -0.405724 +
      dataStructure.SERVICE_DOMAIN[key.S22].scenario_val * 0.342702 +
      dataStructure.SERVICE_DOMAIN[key.S12].scenario_val * 0.137733 +
      dataStructure.SERVICE_DOMAIN[key.S16].scenario_val * dataStructure.SERVICE_DOMAIN[key.S03].scenario_val * -1.135025 +
      dataStructure.SERVICE_DOMAIN[key.S19].scenario_val * dataStructure.SERVICE_DOMAIN[key.S10].scenario_val * 0.645049 +
      dataStructure.SERVICE_DOMAIN[key.S15].scenario_val * dataStructure.SERVICE_DOMAIN[key.S03].scenario_val * -4.991575 +
      dataStructure.SERVICE_DOMAIN[key.S05].scenario_val * dataStructure.SERVICE_DOMAIN[key.S07].scenario_val * -0.284225 +
      dataStructure.SERVICE_DOMAIN[key.S08].scenario_val * dataStructure.SERVICE_DOMAIN[key.S23].scenario_val * 0.068034 +
      dataStructure.SERVICE_DOMAIN[key.S16].scenario_val * dataStructure.SERVICE_DOMAIN[key.S06].scenario_val * -1.697729 +
      dataStructure.SERVICE_DOMAIN[key.S06].scenario_val * dataStructure.SERVICE_DOMAIN[key.S14].scenario_val * 5.52873) -
    (-0.952029 +
      dataStructure.SERVICE_DOMAIN[key.S16][valueType] * 0.938554 +
      dataStructure.SERVICE_DOMAIN[key.S20][valueType] * 0.186626 +
      dataStructure.SERVICE_DOMAIN[key.S15][valueType] * 2.728191 +
      dataStructure.SERVICE_DOMAIN[key.S03][valueType] * 2.2115 +
      dataStructure.SERVICE_DOMAIN[key.S02][valueType] * -0.405724 +
      dataStructure.SERVICE_DOMAIN[key.S22][valueType] * 0.342702 +
      dataStructure.SERVICE_DOMAIN[key.S12][valueType] * 0.137733 +
      dataStructure.SERVICE_DOMAIN[key.S16][valueType] * dataStructure.SERVICE_DOMAIN[key.S03][valueType] * -1.135025 +
      dataStructure.SERVICE_DOMAIN[key.S19][valueType] * dataStructure.SERVICE_DOMAIN[key.S10][valueType] * 0.645049 +
      dataStructure.SERVICE_DOMAIN[key.S15][valueType] * dataStructure.SERVICE_DOMAIN[key.S03][valueType] * -4.991575 +
      dataStructure.SERVICE_DOMAIN[key.S05][valueType] * dataStructure.SERVICE_DOMAIN[key.S07][valueType] * -0.284225 +
      dataStructure.SERVICE_DOMAIN[key.S08][valueType] * dataStructure.SERVICE_DOMAIN[key.S23][valueType] * 0.068034 +
      dataStructure.SERVICE_DOMAIN[key.S16][valueType] * dataStructure.SERVICE_DOMAIN[key.S06][valueType] * -1.697729 +
      dataStructure.SERVICE_DOMAIN[key.S06][valueType] * dataStructure.SERVICE_DOMAIN[key.S14][valueType] * 5.52873);
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["Leisure Time"].scenario_val = val; 

  val = dataStructure.HWBI_DOMAIN["Living Standards"][valueType] +
    (0.789673 +
      dataStructure.SERVICE_DOMAIN[key.S14].scenario_val * 1.47984 +
      dataStructure.SERVICE_DOMAIN[key.S03].scenario_val * 0.278943 +
      dataStructure.SERVICE_DOMAIN[key.S20].scenario_val * 2.364789 +
      dataStructure.SERVICE_DOMAIN[key.S01].scenario_val * 0.348691 +
      dataStructure.SERVICE_DOMAIN[key.S16].scenario_val * 0.113025 +
      dataStructure.SERVICE_DOMAIN[key.S12].scenario_val * 0.139021 +
      dataStructure.SERVICE_DOMAIN[key.S21].scenario_val * -0.811555 +
      dataStructure.SERVICE_DOMAIN[key.S15].scenario_val * -3.51308 +
      dataStructure.SERVICE_DOMAIN[key.S18].scenario_val * -1.320548 +
      dataStructure.SERVICE_DOMAIN[key.S04].scenario_val * 0.000174 +
      dataStructure.SERVICE_DOMAIN[key.S21].scenario_val * dataStructure.SERVICE_DOMAIN[key.S15].scenario_val * 5.571766 +
      dataStructure.SERVICE_DOMAIN[key.S20].scenario_val * dataStructure.SERVICE_DOMAIN[key.S21].scenario_val * -4.438646 +
      dataStructure.SERVICE_DOMAIN[key.S15].scenario_val * dataStructure.SERVICE_DOMAIN[key.S18].scenario_val * 2.809376 +
      dataStructure.SERVICE_DOMAIN[key.S11].scenario_val * dataStructure.SERVICE_DOMAIN[key.S23].scenario_val * 0.106592 +
      dataStructure.SERVICE_DOMAIN[key.S07].scenario_val * dataStructure.SERVICE_DOMAIN[key.S22].scenario_val * -0.163612 +
      dataStructure.SERVICE_DOMAIN[key.S04].scenario_val * dataStructure.SERVICE_DOMAIN[key.S25].scenario_val * -0.289577) -
    (0.789673 +
      dataStructure.SERVICE_DOMAIN[key.S14][valueType] * 1.47984 +
      dataStructure.SERVICE_DOMAIN[key.S03][valueType] * 0.278943 +
      dataStructure.SERVICE_DOMAIN[key.S20][valueType] * 2.364789 +
      dataStructure.SERVICE_DOMAIN[key.S01][valueType] * 0.348691 +
      dataStructure.SERVICE_DOMAIN[key.S16][valueType] * 0.113025 +
      dataStructure.SERVICE_DOMAIN[key.S12][valueType] * 0.139021 +
      dataStructure.SERVICE_DOMAIN[key.S21][valueType] * -0.811555 +
      dataStructure.SERVICE_DOMAIN[key.S15][valueType] * -3.51308 +
      dataStructure.SERVICE_DOMAIN[key.S18][valueType] * -1.320548 +
      dataStructure.SERVICE_DOMAIN[key.S04][valueType] * 0.000174 +
      dataStructure.SERVICE_DOMAIN[key.S21][valueType] * dataStructure.SERVICE_DOMAIN[key.S15][valueType] * 5.571766 +
      dataStructure.SERVICE_DOMAIN[key.S20][valueType] * dataStructure.SERVICE_DOMAIN[key.S21][valueType] * -4.438646 +
      dataStructure.SERVICE_DOMAIN[key.S15][valueType] * dataStructure.SERVICE_DOMAIN[key.S18][valueType] * 2.809376 +
      dataStructure.SERVICE_DOMAIN[key.S11][valueType] * dataStructure.SERVICE_DOMAIN[key.S23][valueType] * 0.106592 +
      dataStructure.SERVICE_DOMAIN[key.S07][valueType] * dataStructure.SERVICE_DOMAIN[key.S22][valueType] * -0.163612 +
      dataStructure.SERVICE_DOMAIN[key.S04][valueType] * dataStructure.SERVICE_DOMAIN[key.S25][valueType] * -0.289577);
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["Living Standards"].scenario_val = val; 

  val = dataStructure.HWBI_DOMAIN["Safety and Security"][valueType] +
    (-0.109546 +
      dataStructure.SERVICE_DOMAIN[key.S19].scenario_val * -2.010049 +
      dataStructure.SERVICE_DOMAIN[key.S08].scenario_val * 2.210816 +
      dataStructure.SERVICE_DOMAIN[key.S20].scenario_val * -1.142788 +
      dataStructure.SERVICE_DOMAIN[key.S18].scenario_val * -2.240351 +
      dataStructure.SERVICE_DOMAIN[key.S14].scenario_val * 4.293024 +
      dataStructure.SERVICE_DOMAIN[key.S16].scenario_val * 0.1171 +
      dataStructure.SERVICE_DOMAIN[key.S05].scenario_val * 0.294652 +
      dataStructure.SERVICE_DOMAIN[key.S04].scenario_val * 0.210137 +
      dataStructure.SERVICE_DOMAIN[key.S24].scenario_val * 3.55136 +
      dataStructure.SERVICE_DOMAIN[key.S21].scenario_val * -2.323739 +
      dataStructure.SERVICE_DOMAIN[key.S07].scenario_val * -0.270444 +
      dataStructure.SERVICE_DOMAIN[key.S19].scenario_val * dataStructure.SERVICE_DOMAIN[key.S21].scenario_val * 5.842987 +
      dataStructure.SERVICE_DOMAIN[key.S03].scenario_val * dataStructure.SERVICE_DOMAIN[key.S25].scenario_val * -0.40061 +
      dataStructure.SERVICE_DOMAIN[key.S08].scenario_val * dataStructure.SERVICE_DOMAIN[key.S24].scenario_val * -4.53954 +
      dataStructure.SERVICE_DOMAIN[key.S20].scenario_val * dataStructure.SERVICE_DOMAIN[key.S18].scenario_val * 4.206231) -
    (-0.109546 +
      dataStructure.SERVICE_DOMAIN[key.S19][valueType] * -2.010049 +
      dataStructure.SERVICE_DOMAIN[key.S08][valueType] * 2.210816 +
      dataStructure.SERVICE_DOMAIN[key.S20][valueType] * -1.142788 +
      dataStructure.SERVICE_DOMAIN[key.S18][valueType] * -2.240351 +
      dataStructure.SERVICE_DOMAIN[key.S14][valueType] * 4.293024 +
      dataStructure.SERVICE_DOMAIN[key.S16][valueType] * 0.1171 +
      dataStructure.SERVICE_DOMAIN[key.S05][valueType] * 0.294652 +
      dataStructure.SERVICE_DOMAIN[key.S04][valueType] * 0.210137 +
      dataStructure.SERVICE_DOMAIN[key.S24][valueType] * 3.55136 +
      dataStructure.SERVICE_DOMAIN[key.S21][valueType] * -2.323739 +
      dataStructure.SERVICE_DOMAIN[key.S07][valueType] * -0.270444 +
      dataStructure.SERVICE_DOMAIN[key.S19][valueType] * dataStructure.SERVICE_DOMAIN[key.S21][valueType] * 5.842987 +
      dataStructure.SERVICE_DOMAIN[key.S03][valueType] * dataStructure.SERVICE_DOMAIN[key.S25][valueType] * -0.40061 +
      dataStructure.SERVICE_DOMAIN[key.S08][valueType] * dataStructure.SERVICE_DOMAIN[key.S24][valueType] * -4.53954 +
      dataStructure.SERVICE_DOMAIN[key.S20][valueType] * dataStructure.SERVICE_DOMAIN[key.S18][valueType] * 4.206231);
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["Safety and Security"].scenario_val = val; 

  val = dataStructure.HWBI_DOMAIN["Social Cohesion"][valueType] +
    (1.559019 +
      dataStructure.SERVICE_DOMAIN[key.S07].scenario_val * -2.494673 +
      dataStructure.SERVICE_DOMAIN[key.S08].scenario_val * 0.148918 +
      dataStructure.SERVICE_DOMAIN[key.S22].scenario_val * -0.168704 +
      dataStructure.SERVICE_DOMAIN[key.S02].scenario_val * 0.067929 +
      dataStructure.SERVICE_DOMAIN[key.S21].scenario_val * -0.301997 +
      dataStructure.SERVICE_DOMAIN[key.S18].scenario_val * -3.215035 +
      dataStructure.SERVICE_DOMAIN[key.S14].scenario_val * 7.179508 +
      dataStructure.SERVICE_DOMAIN[key.S01].scenario_val * -0.283441 +
      dataStructure.SERVICE_DOMAIN[key.S05].scenario_val * -0.729157 +
      dataStructure.SERVICE_DOMAIN[key.S07].scenario_val * dataStructure.SERVICE_DOMAIN[key.S18].scenario_val * 5.161983 +
      dataStructure.SERVICE_DOMAIN[key.S05].scenario_val * dataStructure.SERVICE_DOMAIN[key.S15].scenario_val * 1.171484 +
      dataStructure.SERVICE_DOMAIN[key.S15].scenario_val * dataStructure.SERVICE_DOMAIN[key.S25].scenario_val * -0.61033) -
    (1.559019 +
      dataStructure.SERVICE_DOMAIN[key.S07][valueType] * -2.494673 +
      dataStructure.SERVICE_DOMAIN[key.S08][valueType] * 0.148918 +
      dataStructure.SERVICE_DOMAIN[key.S22][valueType] * -0.168704 +
      dataStructure.SERVICE_DOMAIN[key.S02][valueType] * 0.067929 +
      dataStructure.SERVICE_DOMAIN[key.S21][valueType] * -0.301997 +
      dataStructure.SERVICE_DOMAIN[key.S18][valueType] * -3.215035 +
      dataStructure.SERVICE_DOMAIN[key.S14][valueType] * 7.179508 +
      dataStructure.SERVICE_DOMAIN[key.S01][valueType] * -0.283441 +
      dataStructure.SERVICE_DOMAIN[key.S05][valueType] * -0.729157 +
      dataStructure.SERVICE_DOMAIN[key.S07][valueType] * dataStructure.SERVICE_DOMAIN[key.S18][valueType] * 5.161983 +
      dataStructure.SERVICE_DOMAIN[key.S05][valueType] * dataStructure.SERVICE_DOMAIN[key.S15][valueType] * 1.171484 +
      dataStructure.SERVICE_DOMAIN[key.S15][valueType] * dataStructure.SERVICE_DOMAIN[key.S25][valueType] * -0.61033);
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["Social Cohesion"].scenario_val = val;
}

function loadMetricValues(valueType) {
  var choice = dialog.showMessageBoxSync(
    {
      type: 'question',
      buttons: ['Yes', 'No'],
      title: 'Load Customized Service Metric Values',
      message: 'Loading customized service metric values will replace any changes you have made below with the values you specified in the Customize Data -> Services section.\n\nDo you still want to proceed?'
    });
  if (choice === 0) {
    // setServiceScenarioValue(valueType);
    resetDomainSliders(dataStructure.SERVICE_DOMAIN, valueType, 'scenario-builder-domain');
    updateAllAvgValues('SERVICE_INDICATOR', 'scenario_val', dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
    updateAllAvgValues('SERVICE_DOMAIN', 'scenario_val', dataStructure); // calculate the domain scores by averaging each domain's child indicators
    updateAllAvgValues('METRIC_GROUP', 'scenario_val', dataStructure); // calculate the metric group scores by averaging each metric group's child domains
    setScenarioBuilderDomainValues(valueType);
    calculateServiceHWBI();
    runAsterPlot();
    toggleCustomizedDataMessage();
  }
}

function setScenarioBuilderDomainValues(valueType) {
  for (const domain in dataStructure.SERVICE_DOMAIN) {
    dataStructure.SERVICE_DOMAIN[domain].scenario_val = dataStructure.SERVICE_DOMAIN[domain][valueType];
  }
}

/**
 * Listen for open file from main process. Displays the saved data.
 * @param {event} event - The event.
 * @param {array} arg - An array containing the data, and the data type
 * @listens open-file
 */
ipcRenderer.on('open-file', (event, arg) => {
  $('#community-snapshot-tab').hide();
  $('.preload-wrapper, .preload').show();

  locationValue = JSON.stringify({
    "county": arg[0][0].Value,
    "state_abbr": arg[0][1].Value,
    "state": arg[0][2].Value
  });

  let state = arg[0][1].Value;
  let county = arg[0][0].Value;

  let loadedValues = {};
  arg[0].forEach((row) => {
    if (!Number.isNaN(row.Identifier) && !Number.isNaN(row.Value)) {
      loadedValues[row.Identifier] = +row.Value;
    }
  });

  initializeRankingDonut();
  getStateDomainScores(state);

  let sql = "SELECT  MetricVariables.METRIC_VAR, " +
                    "MetricScores.SCORE, " +
                    "Counties.COUNTY_NAME, " +
                    "Counties.STATE_CODE, " +
                    "MetricGroups.METRIC_GROUP, " +
                    "MetricScores.MINVAL, " +
                    "MetricScores.MAXVAL, " +
                    "MetricScores.POS_NEG_METRIC, " +
                    "MetricVariables.UNITS, " +
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

      if ((row.UNITS.toLowerCase().trim() === 'percent'
      || row.UNITS.toLowerCase().trim() === 'percent changed')) {
          roundValue = 1;
          if (row.METRIC_GROUP.toLowerCase() === 'hwbi') {
            rawVal *= 100;
          }
      }

      if (row.UNITS.toLowerCase().trim() === "dollars") {
        roundValue = 2;
      }

      $ele.val(row.SCORE); // set the metric scores
      $ele.prev().html("<span> " + round(rawVal, roundValue) + " (" + row.UNITS + ")</span>");
      if (row.METRIC_GROUP_ID == 1) {
        metricType = "HWBI_METRIC";
      } else if (row.METRIC_GROUP_ID == 2 || row.METRIC_GROUP_ID == 3 || row.METRIC_GROUP_ID == 4) {
        metricType = "SERVICE_METRIC";
      }
      dataStructure[metricType][row.METRIC_ID].pos_neg = row.POS_NEG_METRIC; // add the metric score to the data structure
      dataStructure[metricType][row.METRIC_ID].original_val = row.SCORE; // add the metric score to the data structure
      dataStructure[metricType][row.METRIC_ID].custom_val = row.SCORE; // add the metric score to the data structure
      dataStructure[metricType][row.METRIC_ID].scenario_val = row.SCORE; // add the metric score to the data structure
      
      if (row.SCORE !== loadedValues[row.METRIC_ID]) { // Replace DB values with loaded values
        dataStructure[metricType][row.METRIC_ID][arg[1]] = loadedValues[row.METRIC_ID];
      }
    });

    setAllInitialAvgValues('SERVICE_INDICATOR', dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
    setAllInitialAvgValues('SERVICE_DOMAIN', dataStructure); // calculate the domain scores by averaging each domain's child indicators

    setAllInitialAvgValues('HWBI_INDICATOR', dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
    setAllInitialAvgValues('HWBI_DOMAIN', dataStructure); // calculate the domain scores by averaging each domain's child indicators

    setAllInitialAvgValues('METRIC_GROUP', dataStructure); // calculate the domain scores by averaging each domain's child indicators
    setAllInitialWeightedAvgValues('METRIC_GROUP', dataStructure); // calculate the metric group scores by averaging each metric group's chil

    updateAllAvgValues('SERVICE_INDICATOR', arg[1], dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
    updateAllAvgValues('SERVICE_DOMAIN', arg[1], dataStructure); // calculate the domain scores by averaging each domain's child indicators
    
    updateAllAvgValues('HWBI_INDICATOR', arg[1], dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
    updateAllAvgValues('HWBI_DOMAIN', arg[1], dataStructure); // calculate the domain scores by averaging each domain's child indicators
    
    updateAllWeightedAvgValues('METRIC_GROUP', arg[1], dataStructure); // calculate the metric group scores by averaging each metric group's child domains

    setScoreData(state, county, "custom_val"); // set the domain scores

    updateApexCharts("custom_val");

    loadSkillbar(); // update the colored bars on the snapshot page
    calculateServiceHWBI();
    runAsterPlot(); //draw aster plot

    $('.preload').fadeOut();
    $('.preload-wrapper').delay(350).fadeOut('slow');
    show('mainpage', 'homepage');
    $('#community-snapshot-tab-link').trigger("click");
    $('#customize_location').html(county + ", " + state);
  });
});

/**
 * Listen for save-file from main process
 * @param {event} event - The event.
 * @param {array} arg - An array containing the data, and the data type
 * @listens save
 */
ipcRenderer.on('save', (event, arg) => {
  console.log(`save ${arg[0]} ${arg[1]}`)
  const type = arg[1];
  const location = JSON.parse(locationValue);
  let csv = 'Identifier,Value\n';
  csv += 'county,"' + location.county + '"\n';
  csv += 'state_abbr,' + location.state_abbr + '\n';
  csv += 'state,' + location.state + '\n';
  csv += '"Connection to Nature",' + dataStructure.HWBI_DOMAIN[1].weight + '\n';
  csv += '"Cultural Fullfillment",' + dataStructure.HWBI_DOMAIN[2].weight + '\n';
  csv += '"Education",' + dataStructure.HWBI_DOMAIN[15].weight + '\n';
  csv += '"Health",' + dataStructure.HWBI_DOMAIN[4].weight + '\n';
  csv += '"Leisure Time",' + dataStructure.HWBI_DOMAIN[5].weight + '\n';
  csv += '"Living Standards",' + dataStructure.HWBI_DOMAIN[6].weight + '\n';
  csv += '"Safety and Security",' + dataStructure.HWBI_DOMAIN[7].weight + '\n';
  csv += '"Social Cohesion",' + dataStructure.HWBI_DOMAIN[8].weight + '\n';
  csv += '"Resilience",' + dataStructure.HWBI_DOMAIN[9].weight + '\n';

	const allMetrics = {...dataStructure.HWBI_METRIC, ...dataStructure.SERVICE_METRIC};
  const query = 'select ID from MetricVariables;';
  db.all(query, [], (err, rows) => {
    if (err) {
      throw err;
    }
    rows.forEach((row) => {
      csv += row.ID + ',' + allMetrics[row.ID][type] + '\n'
    });
    ipcRenderer.send(arg[0], csv);
  });
});

/**
 * Listen for has-been-saved from main process. Displays toast with save file location.
 * @param {event} event - The event.
 * @param {string} arg - A string containing the location of the save file.
 * @listens has-been-saved
 */
ipcRenderer.on('has-been-saved', (event, arg) => {
  toast(`File saved as ${ arg }`);
});

// Send JSON string to write to file
/**
 * Listen for request-json from main process. Gathers and sends the state data to the main process.
 * @param {event} event - The event.
 * @param {string} arg - An string designating the save type. save | save-as
 * @listens request-json
 */
ipcRenderer.on('request-json', (event, arg) => {
  ipcRenderer.send('json-' + arg, JSON.stringify(
    {
      metrics: { ...dataStructure.SERVICE_METRIC, ...dataStructure.HWBI_METRIC },
      RIVs: dataStructure.HWBI_DOMAIN,
      location: JSON.parse(locationValue),
      scenarioBuilderDomains: dataStructure.SERVICE_DOMAIN
    }, 
    getCircularReplacer())
  );
});

/**
 * Removes the circular references from the object. Adapted from: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value
 * @function
 * @return {boolean} - True if they are the same; False if they aren't.
 */
const getCircularReplacer = () => {
  return (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (key === "parent" || key === "children") {
        return;
      }
    }
    return value;
  };
};

/**
 * Listen for load-json from main process. Load the data from JSON.
 * @param {event} event - The event.
 * @param {object} arg - A JSON object containing the location and metric data to display
 * @listens load-json
 */
ipcRenderer.on('load-json', (event, arg) => {
  $('#community-snapshot-tab').hide();
  $('.preload-wrapper, .preload').show();

  // Set the RIVs
  for (let id in arg.RIVs) {
    const domain = arg.RIVs[id];
    dataStructure[domain.type][id].weight = arg.RIVs[id].weight;
    document.querySelector(`.rankinglist input[name="${ slugify(domain.name) }-rank-number"]`).value = arg.RIVs[id].weight;
  }

  // Set location
  locationValue = JSON.stringify(arg.location);

  const metrics = arg.metrics;
  const state = arg.location.state;
  const state_abbr = arg.location.state_abbr;
  const county = arg.location.county;

  initializeRankingDonut();
  getStateDomainScores(state_abbr);

  // Load metrics
  for (let id in metrics) {
    const metric = dataStructure[metrics[id].type][id];
    const type = metric.type;
    let $ele;
    let roundValue = 3;
    
    metric.original_val = metrics[id].original_val;
    metric.scenario_val = metrics[id].scenario_val;
    metric.custom_val = metrics[id].custom_val;

    if (type === "HWBI_METRIC") {
      // Set HWBI Custom Values
      $ele = $('[data-var="' + id + '"].customize-hwbi-metrics');
      $ele.val(metrics[id].custom_val);
      if ($ele.attr('data-sign') === "P") {
        rawVal = (metrics[id].custom_val * (+$ele.attr('data-max') - +$ele.attr('data-min')) + +$ele.attr('data-min'));
      } else if ($ele.attr('data-sign') === "N") {
        rawVal = -1 * ((metrics[id].custom_val - 1) * (+$ele.attr('data-max') - +$ele.attr('data-min'))) + +$ele.attr('data-min');
      }

      if (($('[data-var="' + id + '"].customize-hwbi-metrics').attr('data-units').toLowerCase().trim() === 'percent'
      || $('[data-var="' + id + '"].customize-hwbi-metrics').attr('data-units').toLowerCase().trim() === 'percent changed')) {
        rawVal *= 100;
        roundValue = 1;
      }

      if ($ele.attr('data-sign') === "P") {
        rawVal = (metrics[id].custom_val * (+$ele.attr('data-max') - +$ele.attr('data-min')) + +$ele.attr('data-min'));
      } else if ($ele.attr('data-sign') === "N") {
        rawVal = -1 * ((metrics[id].custom_val - 1) * (+$ele.attr('data-max') - +$ele.attr('data-min'))) + +$ele.attr('data-min');
      }

      if (($ele.attr('data-units').toLowerCase().trim() === 'percent'
      || $ele.attr('data-units').toLowerCase().trim() === 'percent changed')) {
        roundValue = 1;
      }
  
      if ($ele.attr('data-units').toLowerCase().trim() === "dollars") {
        roundValue = 2;
      }

      if ($ele.attr('data-units')) {
        $ele.prev().html("<span> " + round(rawVal, roundValue) + " (" + $ele.attr('data-units') + ")</span>");
      } else {
        $ele.prev().html("<span> " + round(rawVal, roundValue) + "</span>");
      }

    } else {
      // Set Service Scenario Builder Values
      $ele = $('[data-var="' + id + '"].scenario-builder-metric');
      $ele.val(metrics[id].scenario_val);

      if ($ele.attr('data-sign') === "P") {
        rawVal = (metrics[id].custom_val * (+$ele.attr('data-max') - +$ele.attr('data-min')) + +$ele.attr('data-min'));
      } else if ($ele.attr('data-sign') === "N") {
        rawVal = -1 * ((metrics[id].custom_val - 1) * (+$ele.attr('data-max') - +$ele.attr('data-min'))) + +$ele.attr('data-min');
      }
  
      if ($ele.attr('data-units').toLowerCase().trim() === "dollars") {
        roundValue = 2;
      }
      $ele.prev().html("<span> " + round(rawVal, roundValue) + " (" + $ele.attr('data-units') + ")</span>");

      // Set Service Custom Values
      $ele = $('[data-var="' + id + '"].customize-service-metrics');
      $ele.val(metrics[id].custom_val);

      if ($ele.attr('data-sign') === "P") {
        rawVal = (metrics[id].custom_val * (+$ele.attr('data-max') - +$ele.attr('data-min')) + +$ele.attr('data-min'));
      } else if ($ele.attr('data-sign') === "N") {
        rawVal = -1 * ((metrics[id].custom_val - 1) * (+$ele.attr('data-max') - +$ele.attr('data-min'))) + +$ele.attr('data-min');
      }
  
      if ($ele.attr('data-units').toLowerCase().trim() === "dollars") {
        roundValue = 2;
      }
      $ele.prev().html("<span> " + round(rawVal, roundValue) + " (" + $ele.attr('data-units') + ")</span>");
    }
  }

  // Calculate Indicator / Domain scores
  setAllInitialAvgValues('SERVICE_INDICATOR', dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
  setAllInitialAvgValues('SERVICE_DOMAIN', dataStructure); // calculate the domain scores by averaging each domain's child indicators

  setAllInitialAvgValues('HWBI_INDICATOR', dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
  setAllInitialAvgValues('HWBI_DOMAIN', dataStructure); // calculate the domain scores by averaging each domain's child indicators

  setAllInitialAvgValues('METRIC_GROUP', dataStructure); // calculate the domain scores by averaging each domain's child indicators
  setAllInitialWeightedAvgValues('METRIC_GROUP', dataStructure); // calculate the metric group scores by averaging each metric group's chil

  updateAllAvgValues('SERVICE_INDICATOR', "custom_val", dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
  updateAllAvgValues('SERVICE_DOMAIN', "custom_val", dataStructure); // calculate the domain scores by averaging each domain's child indicators
  
  updateAllAvgValues('HWBI_INDICATOR', "custom_val", dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
  updateAllAvgValues('HWBI_DOMAIN', "custom_val", dataStructure); // calculate the domain scores by averaging each domain's child indicators
  
  updateAllWeightedAvgValues('METRIC_GROUP', "custom_val", dataStructure); // calculate the metric group scores by averaging each metric group's child domains

  // Load data into the UI
  setScoreData(state, county, "custom_val"); // set the domain scores

  // set data for compare map
  comp_setCompareMapData(state_abbr, county);

  updateApexCharts("custom_val");
  
  loadSkillbar(); // update the colored bars on the snapshot page

  for (const domain in dataStructure.SERVICE_DOMAIN) {
    dataStructure.SERVICE_DOMAIN[domain].scenario_val = arg.scenarioBuilderDomains[domain].scenario_val;
  }

  resetDomainSliders(dataStructure.SERVICE_DOMAIN, 'scenario_val', 'scenario-builder-domain');
  toggleCustomizedDataMessage();

  calculateServiceHWBI('custom_val');
  runAsterPlot(); //draw aster plot
  $('#customize_location').html(county + ", " + state);

  $('.preload').fadeOut();
  $('.preload-wrapper').delay(350).fadeOut('slow');
  show('mainpage', 'homepage');
  $('#community-snapshot-tab-link').trigger("click");
});

function hamburgerMenu() {
  $('.sidenav').toggleClass('no-mobile');
  $('.hamburger-line').toggleClass('h-active');
  /* if(hmenu.hasClass('no-mobile')) {
      $(hmenu).addClass('no-mobile');
      $('.hamburger-line').removeClass('h-active');
  } */
  
};


$('.sidenav li').on('click', function() {
  if (!$('.sidenav').hasClass('no-mobile')) {
    $('.sidenav').addClass('no-mobile')
    $('#hamburger div').removeClass('h-active')
  }
});


function searchToggle() {
  $('.search-icon-toggle').addClass('hide');
  if ($('#mainpage-statecounty').hasClass('offline-active')) {
    $('#mainpage-statecounty').css('right', '0');
  } else {
    $('.search').css('right', '0');
    $('.search input').focus();
  }
  
}

$('#top_local_search').on('focusout', function() {
  $('.search').css('right', '-420px');
  $('.search-icon-toggle').removeClass('hide');
});

$('#mainpage-county-state-select .close').click(function() {
  $('#mainpage-statecounty').css('right', '-500px');
  $('.search-icon-toggle').removeClass('hide');
});

function resetAll() {
  const choice = dialog.showMessageBoxSync(
    {
        type: 'question',
        buttons: ['Yes', 'No'],
        title: `Reset All Changes`,
        message: `Are you sure you want to reset all changes to the Customize pages, Scenario Builder, and Priority Rankings?`,
    });
    if (choice === 0) {
        /* $("#reset-scenario-builder-btn, #reset-hwbi-domains, #reset-service-btn, #riv-reset-btn").trigger('click'); */
        resetServices();
        resetServiceScores("custom_val");

        resetDomains();
        
        resetRivs();
        updateRivUi();
        
        let baselineValue = 'original_val'; 

        // isCustomized() ? baselineValue = 'custom_val' : baselineValue = 'original_val';

        resetValues(dataStructure.METRIC_GROUP.HWBI, 'scenario_val', baselineValue);
        resetValues(dataStructure.METRIC_GROUP.CRSI, 'scenario_val', baselineValue);
        resetValues(dataStructure.METRIC_GROUP.Social, 'scenario_val', baselineValue);
        resetValues(dataStructure.METRIC_GROUP.Economic, 'scenario_val', baselineValue);
        resetValues(dataStructure.METRIC_GROUP.Ecosystem, 'scenario_val', baselineValue);
        
        resetDomainSliders(dataStructure.SERVICE_DOMAIN, 'scenario_val', 'scenario-builder-domain');

        calculateServiceHWBI();
        runAsterPlot();
        toggleCustomizedDataMessage();
    }
}

let drawn = false;
// set the dimensions and margins of the graph
const margin = { top: 30, right: 30, bottom: 30, left: 200 };
const width = 450 - margin.left - margin.right;
const height = 450 - margin.top - margin.bottom;

// append the svg object to the body of the page
const svg = d3
  .select("#heat-chart")
  .append("svg")
  .attr("width", width + margin.left + margin.right)
  .attr("height", height + margin.top)
  .append("g")
  .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// Labels of row and columns
const myGroups = ["Domain"];
const myconsts = [
  "Social Cohesion",
  "Safety and Security",
  "Living Standards",
  "Leisure Time",
  "Health",
  "Education",
  "Cultural Fulfillment",
  "Connection to Nature"
];

  // Build X scales and axis:
  const x = d3
  .scaleBand()
  .range([0, width])
  .domain(myGroups)
  .padding(0.01);

// Build X scales and axis:
const y = d3
  .scaleBand()
  .range([height, 0])
  .domain(myconsts)
  .padding(0.01);
svg.append("g").style("font-size", "17px").call(d3.axisLeft(y));

// Build color scale
const myColor = d3
  .scaleLinear()
  .range(["#e9f5f2", "#254d44"])
  .domain([0, 10]);

function drawAsterPlot(data) {
  svg
    .selectAll()
    .data(data, function(d) {
      return d.description;
    })
    .enter()
    .append("rect")
    .attr("x", function(d) {
      return 3;
    })
    .attr("y", function(d) {
      return y(d.description);
    })
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .style("fill", function(d) {
      return myColor((d.score > 10 ? 10 : d.score));
    });


  var h = 50;

  var key = d3
    .select("#legend1")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", h);

  var legend = key
    .append("defs")
    .append("svg:linearGradient")
    .attr("id", "gradient")
    .attr("x1", "0%")
    .attr("y1", "100%")
    .attr("x2", "100%")
    .attr("y2", "100%")
    .attr("spreadMethod", "pad");

  legend
    .append("stop")
    .attr("offset", "0%")
    .attr("stop-color", "#e9f5f2")
    .attr("stop-opacity", 1);

  legend
    .append("stop")
    .attr("offset", "100%")
    .attr("stop-color", "#254d44")
    .attr("stop-opacity", 1);

  key
    .append("rect")
    .attr("width", width)
    .attr("height", h - 30)
    .style("fill", "url(#gradient)")
    .attr("transform", "translate(" + margin.left + ",10)");

  var y2 = d3
    .scaleLinear()
    .range([220, 0])
    .domain([10, 0]);

  var yAxis = d3
    .axisBottom()
    .scale(y2)
    .ticks(1);

  key
    .append("g")
    .attr("class", "y axis")
    .attr("transform", "translate(" + margin.left + ",30)")
    .style("font-size", "14px")
    .call(yAxis)
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0)
    .attr("dy", ".71em")
    .style("text-anchor", "end")
    .text("axis title");

  drawn = true;
}

function updateAsterPlot(data) { 
  svg
    .selectAll('rect')
    .data(data, function(d) {
      return d.description;
    })
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .style("fill", function(d) {
      return myColor((d.score > 10 ? 10 : d.score));
    });
}
const url = require("url");
/**
 * Opens a new PDF window when clicking on "more..." on the snapshot page
 * @function
 */
function openMorePDF(block) {
  const win = new BrowserWindow({
    width: 800,
    height: 600
  })

  PDFWindow.addSupport(win)

  let appPath = app.getAppPath()

  win.loadURL(
    url.format({
      pathname: block + '.pdf',
      protocol: 'file:',
      slashes: true
    })
  );
}
/*   win.loadURL('file:///' + path.join(__dirname, '/' + block + '.pdf')) */
