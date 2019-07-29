const electron = require('electron');
const { ipcRenderer, shell } = electron;
const { app, dialog } = electron.remote

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
    const choice = dialog.showMessageBox({
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

function setScoreData(state, county, valueType) {
  document.getElementById('score_indicator_span').style.transform = "rotate(0deg) skew(45deg, -45deg)";
  
  $('#location').html("Snapshot results for<br>" + county + ", " + state); // Set location info
  $('#reportlocation').html("Report for " + county + ", " + state);

  const HWBI_score = round(((dataStructure.METRIC_GROUP['HWBI'][valueType] * dataStructure.METRIC_GROUP['HWBI'].children.length) + (dataStructure.METRIC_GROUP['CRSI'][valueType] * dataStructure.METRIC_GROUP['CRSI'].children.length)) / (dataStructure.METRIC_GROUP['HWBI'].children.length + dataStructure.METRIC_GROUP['CRSI'].children.length) * 100, 1); // Set location score
  $('#wellbeing-score').html(HWBI_score);
  $('.modal-disc-score span').html(HWBI_score);

  document.getElementById('score_indicator_span').style.transform = "rotate(" + Math.round(HWBI_score * 90 / 50) + "deg) skew(45deg, -45deg)"; // set the graphic
  $('#report-wellbeing-score').html(HWBI_score);

  // Display HWBI scores on Customize tabs
  for (const domain in dataStructure.HWBI_DOMAIN) { // Set Domain scores
    const slugifiedDomain = slugify(dataStructure.HWBI_DOMAIN[domain].name);
    const score = round(dataStructure.HWBI_DOMAIN[domain][valueType] * 100, 1);
    $('#' + slugifiedDomain + '_score, #' + slugifiedDomain + '_modal_score').html(score);
    $('#' + slugifiedDomain + '_score_bar').attr('data-percent', score + "%");
    $('#' + slugifiedDomain + '_score_summary').html(score);
  }

  for (const indicator in dataStructure.HWBI_INDICATOR) { // Set indicator scores
    const slugifiedIndicator = slugify(dataStructure.HWBI_INDICATOR[indicator].parent.name) + "_" + slugify(dataStructure.HWBI_INDICATOR[indicator].name);
    const score = round(dataStructure.HWBI_INDICATOR[indicator][valueType] * 100, 1);
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
      const score = round(metricGroup[valueType] * 100, 1);
      $('#' + slugifiedDomain + '_score, #' + slugifiedDomain + '_modal_score').html(score);
    }
  }

  for (const domain in dataStructure.SERVICE_DOMAIN) { // Set Service Domain scores
    const slugifiedDomain = slugify(dataStructure.SERVICE_DOMAIN[domain].parent.name) + "_" + slugify(dataStructure.SERVICE_DOMAIN[domain].name);
    const score = round(dataStructure.SERVICE_DOMAIN[domain][valueType] * 100, 1);
    $('#' + slugifiedDomain + "_value").html(score);
  }

  for (const indicator in dataStructure.SERVICE_INDICATOR) { // Set Service Indicator scores
    const slugifiedIndicator = slugify(dataStructure.SERVICE_INDICATOR[indicator].parent.name) + "_" + slugify(dataStructure.SERVICE_INDICATOR[indicator].name);
    const score = round(dataStructure.SERVICE_INDICATOR[indicator][valueType] * 100, 1);
    $('#' + slugifiedIndicator + "_value").html(score);
  }
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
  resetSliders(dataStructure.SERVICE_METRIC, 'scenario_val', 'scenario-builder-metric');

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
  $(ele).parent().parent().find('.accordion-metrics').addClass('bull');
  $(ele).closest('.card').children('a').find('.card-text-overlay').addClass('bull');
  $(ele).prev().addClass('bull');
});

/**
 * Change the HWBI metric values, update the indicators, domains, and the domains on the snapshot page snapshot
 * @listens change
 */
$('.customize-service-metrics').on('change', function() { // customize metric listeners
  const ele = this;
  const val = +ele.value;
  const loc = JSON.parse(locationValue);
  const state = loc.state_abbr;
  const county = loc.county;
  const metric = dataStructure.SERVICE_METRIC[ele.dataset.var];
  
  metric.custom_val = val;

  updateAllAvgValues('SERVICE_INDICATOR', 'custom_val', dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
  updateAllAvgValues('SERVICE_DOMAIN', 'custom_val', dataStructure); // calculate the domain scores by averaging each domain's child indicators
  updateAllAvgValues('METRIC_GROUP', 'custom_val', dataStructure); // calculate the metric group scores by averaging each metric group's child domains

  //setScoreData(state, county, "custom_val"); // set the domain scores
  resetServiceScores("custom_val");

  updateApexCharts("custom_val");

  //add bullet markers to services when changed
  let innerBtn = $(ele).parent().parent().find('.accordion-metrics');
  let outerBtn = $(innerBtn).parent().parent().parent().children('button');

  $(innerBtn).addClass('bull');
  $(outerBtn).addClass('bull');
  $(ele).closest('.service-card').children('a').find('.card-text-overlay').addClass('bull');
  $(ele).prev().addClass('bull');
  
});

$('.scenario-builder-metric').on('change', function() { // customize metric listeners
  const ele = this;
  const val = +ele.value;
  const metric = dataStructure.SERVICE_METRIC[ele.dataset.var];
  
  metric.scenario_val = val;

  updateAllAvgValues('SERVICE_INDICATOR', 'scenario_val', dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
  updateAllAvgValues('SERVICE_DOMAIN', 'scenario_val', dataStructure); // calculate the domain scores by averaging each domain's child indicators
  updateAllAvgValues('METRIC_GROUP', 'scenario_val', dataStructure); // calculate the metric group scores by averaging each metric group's child domains
  calculateServiceHWBI();
  runAsterPlot();
});

$('.thumb').on('input', function() {
  const ele = this;
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

function getCounty(location) {
  let city = location[0];
  let state = location[1];
  let sql = `SELECT COUNTY_NAME, STATE_CODE
    FROM Cities
    WHERE CITY_NAME ==? AND STATE_NAME ==?`;

  return new Promise( ( resolve, reject ) => {
    db.all(sql, [city, state], (err, rows) => {
        if (err) {
            console.log('Error - getCounty(' + city + ', ' + state + '): ' + err);
            reject(err);
        }
        resolve(rows);
    });
  });
}

function slugify(string) {
  return string.replace(/ /g, '-').replace(/[^0-9a-z-_]/gi, '').toLowerCase().trim();
}

function calculateServiceHWBI(valueType = 'custom_val') {
  let val;
  val = dataStructure.HWBI_DOMAIN["Connection to Nature"][valueType] + (2.431227 +
    0.577159 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"][valueType] +
    -1.755944 * dataStructure.SERVICE_DOMAIN["Activism"][valueType] +
    -0.370377 * dataStructure.SERVICE_DOMAIN["Re-Distribution"][valueType] +
    0.465541 * dataStructure.SERVICE_DOMAIN["Consumption"][valueType] +
    -0.111739 * dataStructure.SERVICE_DOMAIN["Healthcare"][valueType] +
    -2.388524 * dataStructure.SERVICE_DOMAIN["Emergency Preparedness"][valueType] +
    -0.524012 * dataStructure.SERVICE_DOMAIN["Greenspace"][valueType] +
    0.05051 * dataStructure.SERVICE_DOMAIN["Water Quality"][valueType] +
    -1.934059 * dataStructure.SERVICE_DOMAIN["Labor"][valueType] +
    0.211648 * dataStructure.SERVICE_DOMAIN["Public Education"][valueType] +
    -1.998989 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"][valueType] * dataStructure.SERVICE_DOMAIN["Emergency Preparedness"][valueType] +
    2.103267 * dataStructure.SERVICE_DOMAIN["Activism"][valueType] * dataStructure.SERVICE_DOMAIN["Emergency Preparedness"][valueType] +
    3.222831 * dataStructure.SERVICE_DOMAIN["Emergency Preparedness"][valueType] * dataStructure.SERVICE_DOMAIN["Labor"][valueType]
  ) -
  (2.431227 +
    0.577159 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"]["scenario_val"] +
    -1.755944 * dataStructure.SERVICE_DOMAIN["Activism"]["scenario_val"] +
    -0.370377 * dataStructure.SERVICE_DOMAIN["Re-Distribution"]["scenario_val"] +
    0.465541 * dataStructure.SERVICE_DOMAIN["Consumption"]["scenario_val"] +
    -0.111739 * dataStructure.SERVICE_DOMAIN["Healthcare"]["scenario_val"] +
    -2.388524 * dataStructure.SERVICE_DOMAIN["Emergency Preparedness"]["scenario_val"] +
    -0.524012 * dataStructure.SERVICE_DOMAIN["Greenspace"]["scenario_val"] +
    0.05051 * dataStructure.SERVICE_DOMAIN["Water Quality"]["scenario_val"] +
    -1.934059 * dataStructure.SERVICE_DOMAIN["Labor"]["scenario_val"] +
    0.211648 * dataStructure.SERVICE_DOMAIN["Public Education"]["scenario_val"] +
    -1.998989 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Emergency Preparedness"]["scenario_val"] +
    2.103267 * dataStructure.SERVICE_DOMAIN["Activism"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Emergency Preparedness"]["scenario_val"] +
    3.222831 * dataStructure.SERVICE_DOMAIN["Emergency Preparedness"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Labor"]["scenario_val"]
  );
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["Connection to Nature"]["scenario_val"] = val;

  val = dataStructure.HWBI_DOMAIN["Cultural Fulfillment"][valueType] + (-0.22391 +
    2.429595 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"][valueType] +
    -0.100712 * dataStructure.SERVICE_DOMAIN["Air Quality"][valueType] +
    -0.131353 * dataStructure.SERVICE_DOMAIN["Water Quantity"][valueType] +
    0.084694 * dataStructure.SERVICE_DOMAIN["Emergency Preparedness"][valueType] +
    0.191835 * dataStructure.SERVICE_DOMAIN["Public Education"][valueType] +
    0.09992 * dataStructure.SERVICE_DOMAIN["Innovation"][valueType] +
    1.280481 * dataStructure.SERVICE_DOMAIN["Communication"][valueType] +
    -0.097182 * dataStructure.SERVICE_DOMAIN["Production"][valueType] +
    -4.405586 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"][valueType] * dataStructure.SERVICE_DOMAIN["Communication"][valueType] +
    0.23472 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"][valueType] * dataStructure.SERVICE_DOMAIN["Air Quality"][valueType]
  ) -
  (-0.22391 +
    2.429595 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"]["scenario_val"] +
    -0.100712 * dataStructure.SERVICE_DOMAIN["Air Quality"]["scenario_val"] +
    -0.131353 * dataStructure.SERVICE_DOMAIN["Water Quantity"]["scenario_val"] +
    0.084694 * dataStructure.SERVICE_DOMAIN["Emergency Preparedness"]["scenario_val"] +
    0.191835 * dataStructure.SERVICE_DOMAIN["Public Education"]["scenario_val"] +
    0.09992 * dataStructure.SERVICE_DOMAIN["Innovation"]["scenario_val"] +
    1.280481 * dataStructure.SERVICE_DOMAIN["Communication"]["scenario_val"] +
    -0.097182 * dataStructure.SERVICE_DOMAIN["Production"]["scenario_val"] +
    -4.405586 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Communication"]["scenario_val"] +
    0.23472 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Air Quality"]["scenario_val"]
  );
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["Cultural Fulfillment"]["scenario_val"] = val; 

  val = dataStructure.HWBI_DOMAIN["Education"][valueType] + (0.392837 +
    0.350783 * dataStructure.SERVICE_DOMAIN["Family Services"][valueType] +
    0.463786 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"][valueType] +
    -0.48866 * dataStructure.SERVICE_DOMAIN["Production"][valueType] +
    0.078233 * dataStructure.SERVICE_DOMAIN["Public Works"][valueType] +
    -0.441537 * dataStructure.SERVICE_DOMAIN["Justice"][valueType] +
    0.574752 * dataStructure.SERVICE_DOMAIN["Activism"][valueType] +
    -0.37372 * dataStructure.SERVICE_DOMAIN["Consumption"][valueType] +
    0.390576 * dataStructure.SERVICE_DOMAIN["Re-Distribution"][valueType] * dataStructure.SERVICE_DOMAIN["Greenspace"][valueType]
  ) -
  (0.392837 +
    0.350783 * dataStructure.SERVICE_DOMAIN["Family Services"]["scenario_val"] +
    0.463786 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"]["scenario_val"] +
    -0.48866 * dataStructure.SERVICE_DOMAIN["Production"]["scenario_val"] +
    0.078233 * dataStructure.SERVICE_DOMAIN["Public Works"]["scenario_val"] +
    -0.441537 * dataStructure.SERVICE_DOMAIN["Justice"]["scenario_val"] +
    0.574752 * dataStructure.SERVICE_DOMAIN["Activism"]["scenario_val"] +
    -0.37372 * dataStructure.SERVICE_DOMAIN["Consumption"]["scenario_val"] +
    0.390576 * dataStructure.SERVICE_DOMAIN["Re-Distribution"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Greenspace"]["scenario_val"]
  );
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["Education"]["scenario_val"] = val; 

  val = (dataStructure.HWBI_DOMAIN["Health"][valueType] + 0.231086 +
    0.072714 * dataStructure.SERVICE_DOMAIN["Family Services"][valueType] +
    0.194939 * dataStructure.SERVICE_DOMAIN["Communication"][valueType] +
    0.097708 * dataStructure.SERVICE_DOMAIN["Labor"][valueType] +
    0.020422 * dataStructure.SERVICE_DOMAIN["Water Quantity"][valueType] +
    0.095983 * dataStructure.SERVICE_DOMAIN["Innovation"][valueType] +
    0.04914 * dataStructure.SERVICE_DOMAIN["Emergency Preparedness"][valueType] +
    0.52497 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"][valueType] +
    0.149127 * dataStructure.SERVICE_DOMAIN["Justice"][valueType] +
    0.050258 * dataStructure.SERVICE_DOMAIN["Activism"][valueType] * dataStructure.SERVICE_DOMAIN["Public Education"][valueType] +
    -0.866259 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"][valueType] * dataStructure.SERVICE_DOMAIN["Justice"][valueType]
  ) -
  (0.231086 +
    0.072714 * dataStructure.SERVICE_DOMAIN["Family Services"]["scenario_val"] +
    0.194939 * dataStructure.SERVICE_DOMAIN["Communication"]["scenario_val"] +
    0.097708 * dataStructure.SERVICE_DOMAIN["Labor"]["scenario_val"] +
    0.020422 * dataStructure.SERVICE_DOMAIN["Water Quantity"]["scenario_val"] +
    0.095983 * dataStructure.SERVICE_DOMAIN["Innovation"]["scenario_val"] +
    0.04914 * dataStructure.SERVICE_DOMAIN["Emergency Preparedness"]["scenario_val"] +
    0.52497 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"]["scenario_val"] +
    0.149127 * dataStructure.SERVICE_DOMAIN["Justice"]["scenario_val"] +
    0.050258 * dataStructure.SERVICE_DOMAIN["Activism"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Public Education"]["scenario_val"] +
    -0.866259 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Justice"]["scenario_val"]
  );
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["Health"]["scenario_val"] = val; 

  val = dataStructure.HWBI_DOMAIN["Leisure Time"][valueType] + (0.506212 +
    -0.340958 * dataStructure.SERVICE_DOMAIN["Employment"][valueType] +
    -0.719677 * dataStructure.SERVICE_DOMAIN["Water Quantity"][valueType] +
    -0.39237 * dataStructure.SERVICE_DOMAIN["Consumption"][valueType] +
    0.682084 * dataStructure.SERVICE_DOMAIN["Food, Fiber and Fuel Provisioning"][valueType] +
    -0.053742 * dataStructure.SERVICE_DOMAIN["Water Quality"][valueType] +
    0.138196 * dataStructure.SERVICE_DOMAIN["Greenspace"][valueType] +
    -0.544925 * dataStructure.SERVICE_DOMAIN["Public Education"][valueType] +
    0.577271 * dataStructure.SERVICE_DOMAIN["Public Works"][valueType] +
    -0.217388 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"][valueType] +
    0.934746 * dataStructure.SERVICE_DOMAIN["Activism"][valueType] +
    1.599972 * dataStructure.SERVICE_DOMAIN["Water Quantity"][valueType] * dataStructure.SERVICE_DOMAIN["Public Education"][valueType] +
    0.206249 * dataStructure.SERVICE_DOMAIN["Finance"][valueType] * dataStructure.SERVICE_DOMAIN["Communication"][valueType] +
    -1.29474 * dataStructure.SERVICE_DOMAIN["Public Works"][valueType] * dataStructure.SERVICE_DOMAIN["Activism"][valueType] +
    -0.171528 * dataStructure.SERVICE_DOMAIN["Public Education"][valueType] * dataStructure.SERVICE_DOMAIN["Innovation"][valueType]
  ) -
  (0.506212 +
    -0.340958 * dataStructure.SERVICE_DOMAIN["Employment"]["scenario_val"] +
    -0.719677 * dataStructure.SERVICE_DOMAIN["Water Quantity"]["scenario_val"] +
    -0.39237 * dataStructure.SERVICE_DOMAIN["Consumption"]["scenario_val"] +
    0.682084 * dataStructure.SERVICE_DOMAIN["Food, Fiber and Fuel Provisioning"]["scenario_val"] +
    -0.053742 * dataStructure.SERVICE_DOMAIN["Water Quality"]["scenario_val"] +
    0.138196 * dataStructure.SERVICE_DOMAIN["Greenspace"]["scenario_val"] +
    -0.544925 * dataStructure.SERVICE_DOMAIN["Public Education"]["scenario_val"] +
    0.577271 * dataStructure.SERVICE_DOMAIN["Public Works"]["scenario_val"] +
    -0.217388 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"]["scenario_val"] +
    0.934746 * dataStructure.SERVICE_DOMAIN["Activism"]["scenario_val"] +
    1.599972 * dataStructure.SERVICE_DOMAIN["Water Quantity"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Public Education"]["scenario_val"] +
    0.206249 * dataStructure.SERVICE_DOMAIN["Finance"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Communication"]["scenario_val"] +
    -1.29474 * dataStructure.SERVICE_DOMAIN["Public Works"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Activism"]["scenario_val"] +
    -0.171528 * dataStructure.SERVICE_DOMAIN["Public Education"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Innovation"]["scenario_val"]
  );
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["Leisure Time"]["scenario_val"] = val; 

  val = dataStructure.HWBI_DOMAIN["Living Standards"][valueType] + (0.275027 +
    0.092259 * dataStructure.SERVICE_DOMAIN["Employment"][valueType] +
    -0.146247 * dataStructure.SERVICE_DOMAIN["Public Works"][valueType] +
    0.134713 * dataStructure.SERVICE_DOMAIN["Labor"][valueType] +
    0.367559 * dataStructure.SERVICE_DOMAIN["Activism"][valueType] +
    -0.259411 * dataStructure.SERVICE_DOMAIN["Finance"][valueType] +
    -0.17859 * dataStructure.SERVICE_DOMAIN["Justice"][valueType] +
    0.078427 * dataStructure.SERVICE_DOMAIN["Water Quantity"][valueType] +
    -0.024932 * dataStructure.SERVICE_DOMAIN["Capital Investment"][valueType] +
    0.708609 * dataStructure.SERVICE_DOMAIN["Public Works"][valueType] * dataStructure.SERVICE_DOMAIN["Finance"][valueType] +
    -0.038308 * dataStructure.SERVICE_DOMAIN["Capital Investment"][valueType] * dataStructure.SERVICE_DOMAIN["Water Quality"][valueType] +
    0.177212 * dataStructure.SERVICE_DOMAIN["Food, Fiber and Fuel Provisioning"][valueType] * dataStructure.SERVICE_DOMAIN["Communication"][valueType]
  ) - 
  (0.275027 +
    0.092259 * dataStructure.SERVICE_DOMAIN["Employment"]["scenario_val"] +
    -0.146247 * dataStructure.SERVICE_DOMAIN["Public Works"]["scenario_val"] +
    0.134713 * dataStructure.SERVICE_DOMAIN["Labor"]["scenario_val"] +
    0.367559 * dataStructure.SERVICE_DOMAIN["Activism"]["scenario_val"] +
    -0.259411 * dataStructure.SERVICE_DOMAIN["Finance"]["scenario_val"] +
    -0.17859 * dataStructure.SERVICE_DOMAIN["Justice"]["scenario_val"] +
    0.078427 * dataStructure.SERVICE_DOMAIN["Water Quantity"]["scenario_val"] +
    -0.024932 * dataStructure.SERVICE_DOMAIN["Capital Investment"]["scenario_val"] +
    0.708609 * dataStructure.SERVICE_DOMAIN["Public Works"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Finance"]["scenario_val"] +
    -0.038308 * dataStructure.SERVICE_DOMAIN["Capital Investment"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Water Quality"]["scenario_val"] +
    0.177212 * dataStructure.SERVICE_DOMAIN["Food, Fiber and Fuel Provisioning"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Communication"]["scenario_val"]
  );
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["Living Standards"]["scenario_val"] = val; 

  val = dataStructure.HWBI_DOMAIN["Safety and Security"][valueType] + (0.603914 +
    0.294092 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"][valueType] +
    -0.380562 * dataStructure.SERVICE_DOMAIN["Water Quality"][valueType] +
    -0.385317 * dataStructure.SERVICE_DOMAIN["Public Works"][valueType] +
    0.085398 * dataStructure.SERVICE_DOMAIN["Water Quantity"][valueType] +
    1.35322 * dataStructure.SERVICE_DOMAIN["Activism"][valueType] * dataStructure.SERVICE_DOMAIN["Labor"][valueType] +
    -0.304328 * dataStructure.SERVICE_DOMAIN["Production"][valueType] * dataStructure.SERVICE_DOMAIN["Healthcare"][valueType] +
    -1.147411 * dataStructure.SERVICE_DOMAIN["Labor"][valueType] * dataStructure.SERVICE_DOMAIN["Justice"][valueType] +
    0.295058 * dataStructure.SERVICE_DOMAIN["Production"][valueType] * dataStructure.SERVICE_DOMAIN["Food, Fiber and Fuel Provisioning"][valueType] +
    -0.742299 * dataStructure.SERVICE_DOMAIN["Greenspace"][valueType] * dataStructure.SERVICE_DOMAIN["Emergency Preparedness"][valueType] +
    -0.602264 * dataStructure.SERVICE_DOMAIN["Activism"][valueType] * dataStructure.SERVICE_DOMAIN["Finance"][valueType] +
    0.898598 * dataStructure.SERVICE_DOMAIN["Justice"][valueType] * dataStructure.SERVICE_DOMAIN["Emergency Preparedness"][valueType] +
    0.574027 * dataStructure.SERVICE_DOMAIN["Public Works"][valueType] * dataStructure.SERVICE_DOMAIN["Finance"][valueType] +
    0.655645 * dataStructure.SERVICE_DOMAIN["Water Quality"][valueType] * dataStructure.SERVICE_DOMAIN["Public Works"][valueType]
  ) -
  (0.603914 +
    0.294092 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"]["scenario_val"] +
    -0.380562 * dataStructure.SERVICE_DOMAIN["Water Quality"]["scenario_val"] +
    -0.385317 * dataStructure.SERVICE_DOMAIN["Public Works"]["scenario_val"] +
    0.085398 * dataStructure.SERVICE_DOMAIN["Water Quantity"]["scenario_val"] +
    1.35322 * dataStructure.SERVICE_DOMAIN["Activism"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Labor"]["scenario_val"] +
    -0.304328 * dataStructure.SERVICE_DOMAIN["Production"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Healthcare"]["scenario_val"] +
    -1.147411 * dataStructure.SERVICE_DOMAIN["Labor"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Justice"]["scenario_val"] +
    0.295058 * dataStructure.SERVICE_DOMAIN["Production"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Food, Fiber and Fuel Provisioning"]["scenario_val"] +
    -0.742299 * dataStructure.SERVICE_DOMAIN["Greenspace"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Emergency Preparedness"]["scenario_val"] +
    -0.602264 * dataStructure.SERVICE_DOMAIN["Activism"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Finance"]["scenario_val"] +
    0.898598 * dataStructure.SERVICE_DOMAIN["Justice"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Emergency Preparedness"]["scenario_val"] +
    0.574027 * dataStructure.SERVICE_DOMAIN["Public Works"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Finance"]["scenario_val"] +
    0.655645 * dataStructure.SERVICE_DOMAIN["Water Quality"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Public Works"]["scenario_val"]
  );
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["Safety and Security"]["scenario_val"] = val; 

  val = dataStructure.HWBI_DOMAIN["Social Cohesion"][valueType] + (-0.810156 +
    1.07278 * dataStructure.SERVICE_DOMAIN["Justice"][valueType] +
    0.042486 * dataStructure.SERVICE_DOMAIN["Air Quality"][valueType] +
    -0.382991 * dataStructure.SERVICE_DOMAIN["Production"][valueType] +
    1.980596 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"][valueType] +
    0.047261 * dataStructure.SERVICE_DOMAIN["Public Works"][valueType] +
    1.282272 * dataStructure.SERVICE_DOMAIN["Re-Distribution"][valueType] +
    0.100406 * dataStructure.SERVICE_DOMAIN["Capital Investment"][valueType] +
    0.152944 * dataStructure.SERVICE_DOMAIN["Family Services"][valueType] +
    0.120707 * dataStructure.SERVICE_DOMAIN["Labor"][valueType] + 
    1.291316 * dataStructure.SERVICE_DOMAIN["Greenspace"][valueType] + 
    -0.148073 * dataStructure.SERVICE_DOMAIN["Consumption"][valueType] + 
    -3.59425 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"][valueType] * dataStructure.SERVICE_DOMAIN["Re-Distribution"][valueType] +
    -2.048002 * dataStructure.SERVICE_DOMAIN["Justice"][valueType] * dataStructure.SERVICE_DOMAIN["Greenspace"][valueType] +
    -0.036457 * dataStructure.SERVICE_DOMAIN["Employment"][valueType] * dataStructure.SERVICE_DOMAIN["Water Quality"][valueType]
  ) - (-0.810156 +
    1.07278 * dataStructure.SERVICE_DOMAIN["Justice"]["scenario_val"] +
    0.042486 * dataStructure.SERVICE_DOMAIN["Air Quality"]["scenario_val"] +
    -0.382991 * dataStructure.SERVICE_DOMAIN["Production"]["scenario_val"] +
    1.980596 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"]["scenario_val"] +
    0.047261 * dataStructure.SERVICE_DOMAIN["Public Works"]["scenario_val"] +
    1.282272 * dataStructure.SERVICE_DOMAIN["Re-Distribution"]["scenario_val"] +
    0.100406 * dataStructure.SERVICE_DOMAIN["Capital Investment"]["scenario_val"] +
    0.152944 * dataStructure.SERVICE_DOMAIN["Family Services"]["scenario_val"] +
    0.120707 * dataStructure.SERVICE_DOMAIN["Labor"]["scenario_val"] + 
    1.291316 * dataStructure.SERVICE_DOMAIN["Greenspace"]["scenario_val"] + 
    -0.148073 * dataStructure.SERVICE_DOMAIN["Consumption"]["scenario_val"] + 
    -3.59425 * dataStructure.SERVICE_DOMAIN["Community and Faith-Based Initiatives"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Re-Distribution"]["scenario_val"] +
    -2.048002 * dataStructure.SERVICE_DOMAIN["Justice"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Greenspace"]["scenario_val"] +
    -0.036457 * dataStructure.SERVICE_DOMAIN["Employment"]["scenario_val"] * dataStructure.SERVICE_DOMAIN["Water Quality"]["scenario_val"]
  );
  if (val < 0) {
    val = 0;
  }
  if (val > 1) {
    val = 1;
  }
  dataStructure.HWBI_DOMAIN["Social Cohesion"]["scenario_val"] = val;
}

function loadMetricValues(valueType) {
  var choice = dialog.showMessageBox(
    {
      type: 'question',
      buttons: ['Yes', 'No'],
      title: 'Load Customized Service Metric Values',
      message: 'Loading customized service metric values will replace any changes you have made below with the values you specified in the Customize Data -> Services section.\n\nDo you still want to proceed?'
    });
  if (choice === 0) {
    setServiceScenarioValue(valueType);
    updateAllAvgValues('SERVICE_INDICATOR', 'scenario_val', dataStructure); // calculate the indicator scores by averaging each indicator's child metrics
    updateAllAvgValues('SERVICE_DOMAIN', 'scenario_val', dataStructure); // calculate the domain scores by averaging each domain's child indicators
    updateAllAvgValues('METRIC_GROUP', 'scenario_val', dataStructure); // calculate the metric group scores by averaging each metric group's child domains
    calculateServiceHWBI();
    runAsterPlot();
  }
}

function setServiceScenarioValue(valueType) {
  for (let metricName in dataStructure.SERVICE_METRIC) {
      const metric = dataStructure.SERVICE_METRIC[metricName];
      metric.scenario_val = metric[valueType];
      let ele = document.querySelector('[data-var="' + metric.id + '"].scenario-builder-metric');
      ele.value = metric[valueType];
      updateSliderLabel(ele);
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
      "metrics": { ...dataStructure.SERVICE_METRIC, ...dataStructure.HWBI_METRIC },
      "RIVs": dataStructure.HWBI_DOMAIN,
      "location": JSON.parse(locationValue)
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

  updateApexCharts("custom_val");
  
  loadSkillbar(); // update the colored bars on the snapshot page
  calculateServiceHWBI();
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

function searchToggle() {
  $('.search-icon-toggle').addClass('hide');
  if ($('#mainpage-statecounty').hasClass('offline-active')) {
    $('#mainpage-statecounty').css('right', '0');
  } else {
    $('.search').css('right', '0');
    $('.search input').focus();
  }
  
}

$('#top-search-bar').on('focusout', function() {
  $('.search').css('right', '-275px');
  $('.search-icon-toggle').removeClass('hide');
});

$('#mainpage-county-state-select .close').click(function() {
  $('#mainpage-statecounty').css('right', '-500px');
  $('.search-icon-toggle').removeClass('hide');
});