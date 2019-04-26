
const comp_width = 820;
const comp_height = 440;
const center = [comp_width / 2, comp_height / 2];
const noMatchFill = '#FFFFFF';
const selectedFill = '#32BA46';

const formatHwbi = d3.format('.1f');
const qcolors = ['#8c510a', '#D9A55F', '#e0e0e0', '#80cdc1', '#35978f'];
const qlabels = ['Much More', 'More', 'About same', 'Less', 'Much Less'];

let countiesData = [];

let compareRange = 20; // this is the default compare range
// in set_compareRange() the distance between the selected county and the furthest adjacent county
const range_multiplier = 1.4; // (by centroids) is multiplied by this to get search range.

let currFIPS;
let hwbiByFIPS = d3.map();

let projection = d3.geoAlbersUsa();

const zoom = d3.zoom()
    .scaleExtent([1, 8]);

let comp_path = d3.geoPath()
    .projection(projection);

let comp_svg = d3.select('body #map-wrapper').append('svg')
    .attr('class', 'county-map')
    .attr('width', comp_width)
    .attr('height', comp_height)
    .append('g')
    .call(zoom);
comp_svg.on('wheel.zoom', null);
comp_svg.on('mousewheel.zoom', null);

let g = comp_svg.append('g');

let tooltip = d3.select('#tooltip')
    .style('opacity', 0);

let resultPanel = d3.select('#result-panel');

// Legend
let legend = comp_svg.append('g')
    .attr('class', 'legend');
legend.append("rect")
    .attr('x', comp_width - 110)
    .attr('y', comp_height - 170)
    .attr('width', 110)
    .attr('height', 170)
    .attr('fill', '#ffffff')
    .attr('opacity', 0.7);
legend.append('text')
    .attr('class', 'legendheader')
    .attr('x', comp_width - 90)
    .attr('y', comp_height - 150)
    .text('Human');
legend.append('text')
    .attr('class', 'legendheader')
    .attr('x', comp_width - 90)
    .attr('y', comp_height - 135)
    .text('Well-Being');
legend.append('text')
    .attr('class', 'legendheader')
    .attr('x', comp_width - 90)
    .attr('y', comp_height - 120)
    .text('Index');
legend.selectAll('rect.legend')
    .data([0, 1, 2, 3, 4])
    .enter().append('rect')
    .attr('x', comp_width - 90)
    .attr('y', function(d, i) { return comp_height - i * 20 - 30; })
    .attr('width', 10)
    .attr('height', 20)
    .style('fill', function(d, i) { return qcolors[i]; });
legend.selectAll('.ticklabel')
    .data([0, 1, 2, 3, 4])
    .enter().append('text')
    .attr('class', 'ticklabel')
    .attr('x', comp_width - 75)
    .attr('y', function(d, i) { return comp_height - i * 20 - 16; })
    .text(function(d, i) { return qlabels[i]; });

d3.json('comp_map_data/us.json').then(ready);

function ready(us) {
    g.append('g')
        .attr('class', 'counties')
        .selectAll('path')
        .data(topojson.feature(us, us.objects.counties).features)
        .enter().append('path')
        .attr('d', comp_path)
        .attr('fill', noMatchFill)
        .on('mouseover', function(d) {
            if (hwbiByFIPS.has(d.id)) {
                d3.select(this).classed('selected', true);
                tooltip.transition().duration(150)
                    .style('opacity', 1);

                setText(d.id, tooltip);
                compareScores();
            }
        })
        .on('mouseout', function() {
            d3.select(this).classed('selected', false);
            tooltip.transition().duration(300)
                .style('opacity', 0);
        });

    g.append('path')
        .datum(topojson.mesh(us, us.objects.states, function(a, b) { return a !== b; }))
        .attr('class', 'states')
        .attr('d', comp_path);
}

function setText(id, div) {
    let county = hwbiByFIPS.get(id);
    div.select('.name').text(county['name']);
    div.select('.hwbi').html('<text>Well-Being:  <span class="hwbi right">' + formatHwbi(county['hwbi']) + '</span> &plusmn; <span class="moe right">' + formatHwbi(county.moe) + '</span></text>');
    div.select('.cn').html('<text>Connection to Nature:  </text><span class="cn right">' + formatHwbi(county['Connection to Nature']) + '</span> &plusmn; <span class="cn_moe right">' + formatHwbi(county.cn_moe) + '</span>');
    div.select('.cf').html('<text>Cultural Fulfillment:  </text><span class="cf right">' + formatHwbi(county['Cultural Fulfillment']) + '</span> &plusmn; <span class="cf_moe right">' + formatHwbi(county.cf_moe) + '</span>');
    div.select('.ed').html('<text>Education:  </text><span class="ed right">' + formatHwbi(county['Education']) + '</span> &plusmn; <span class="ed_moe right">' + formatHwbi(county.ed_moe) + '</span>');
    div.select('.he').html('<text>Health:  </text><span class="he right">' + formatHwbi(county['Health']) + '</span> &plusmn; <span class="he_moe right">' + formatHwbi(county.he_moe) + '</span>');
    div.select('.lt').html('<text>Leisure Time:  </text><span class="lt right">' + formatHwbi(county['Leisure Time']) + '</span> &plusmn; <span class="lt_moe right">' + formatHwbi(county.lt_moe) + '</span>');
    div.select('.ls').html('<text>Living Standards:  </text><span class="ls right">' + formatHwbi(county['Living Standards']) + '</span> &plusmn; <span class="ls_moe right">' + formatHwbi(county.ls_moe) + '</span>');
    div.select('.ss').html('<text>Safety &amp; Security:  </text><span class="ss right">' + formatHwbi(county['Safety and Security']) + '</span> &plusmn; <span class="ss_moe right">' + formatHwbi(county.ss_moe) + '</span>');
    div.select('.sc').html('<text>Social Cohesion:  </text><span class="sc right">' + formatHwbi(county['Social Cohesion']) + '</span> &plusmn; <span class="sc_moe right">' + formatHwbi(county.sc_moe) + '</span>');
    div.select('.re').html('<text>Resiliency:  </text><span class="re right">' + formatHwbi(county['Resiliency']) + '</span> &plusmn; <span class="re_moe right">' + formatHwbi(county.re_moe) + '</span>');
}

function compareScores() {
    // TODO: there is a better way, this was easiest to get up and working
    const domains = ['hwbi right', 'cn right', 'cf right', 'ed right', 'he right', 'lt right', 'ls right', 'ss right', 'sc right', 're right'];

    for (let i = 0; i < domains.length; i++) {
        let scores = document.getElementsByClassName(domains[i]);
        scores[0].classList.remove('better', 'worse');
        scores[1].classList.remove('better', 'worse');
        if (parseFloat(scores[0].innerText) > parseFloat(scores[1].innerText)) {
            scores[0].classList.add('better');
            scores[1].classList.add('worse');
        } else if (parseFloat(scores[0].innerText) < parseFloat(scores[1].innerText)) {
            scores[0].classList.add('worse');
            scores[1].classList.add('better');
        }
    }
}

async function comp_setCompareMapData(state, county) {
    currFIPS = parseInt((await db_get_fips(county, state)).FIPS);
    setFill();
    hwbiByFIPS.set(currFIPS, await(dbGetCountyScores(currFIPS)));
    setText(currFIPS, resultPanel);
    scoreWithinRangeByFIPS(currFIPS);
}

async function scoreWithinRangeByFIPS(fips) {
    // SET THE COMPARE RANGE...
    // this could be more accurate by allowing a range of deviation for points to be "the same"
    // using path coords instead of centroids would most likely give a more complete search
    let currentCountyGeo = null;

    let counties = comp_svg.selectAll('.counties path');

    for (let i = 0; i < counties._groups[0].length; i++) {
        if (fips === counties._groups[0][i].__data__.id) {
            currentCountyGeo = counties._groups[0][i].__data__;
        }
    }
    let currentCentroid = comp_path.centroid(currentCountyGeo);

    let adjacentCounties = [];

    // for every county in the list whose ID != currentCountyID
    for (let i = 0; i < counties._groups[0].length; i++) {
        let countyData = counties._groups[0][i].__data__;
        let countyID = countyData.id;
        if (fips !== countyID) {
            let countyGeo = countyData.geometry.coordinates[0];
            for (let j = 0; j < currentCountyGeo.geometry.coordinates[0].length; j++) {
                let coord1 = currentCountyGeo.geometry.coordinates[0][j];
                // see if any of the coord pairs match, if so they are touching
                for (let k = 0; k < countyGeo.length; k++) {
                    let coord2 = countyGeo[k];
                    if (coord1[0] === coord2[0] && coord1[1] === coord2[1]) {
                        adjacentCounties.push(distance(currentCentroid, comp_path.centroid(countyData)));
                    }
                }
            }
        }
    }
    if (adjacentCounties.length >= 1) {
        let farthest = adjacentCounties[0];
        for (let i = 1; i < adjacentCounties.length; i++) {
            if (farthest < adjacentCounties[i]) {
                farthest = adjacentCounties[i];
            }
        }
        compareRange = farthest * range_multiplier;
    }

    centerAndZoom(currentCentroid, compareRange);

    // SCORE WITHIN RANGE
    countiesData = [];
    for (let i = 0; i < counties._groups[0].length; i++) {
        let countyID = counties._groups[0][i].__data__.id;
        if (fips !== countyID) {
            let otherCentroid = comp_path.centroid(counties._groups[0][i].__data__);
            // TODO: could check here to see if the county has been scored on a previous search
            if (distance(currentCentroid, otherCentroid) < compareRange) {
                let data = await dbGetCountyScores(countyID);
                setData(data);
            }
        }
    }
}

function setData(d) {
    countiesData.push(d);
    hwbiByFIPS.set(d.FIPS, d);
    setFill();
}

async function dbGetCountyScores(fips) {
    let data = {};
    let id = fips.toString();

    if (id.length < 5) {
        id = '0' + id;
    }

    let comp_location = await db_get_location(id);
    let name = comp_location['COUNTY_NAME'] + ' County, ' + comp_location['STATE_CODE'];

    let scores = await db_get_data(comp_location['COUNTY_NAME'], comp_location['STATE_CODE']);
    let hwbi = 0;
    for (let i = 0; i < scores.length; i++) {
        data[scores[i].DOMAIN] = scores[i]['avg(SCORE)'] * 100;
        hwbi += scores[i]['avg(SCORE)'];
    }
    data.hwbi = hwbi / scores.length * 100;
    data.FIPS = fips;
    data.name = name;

    return data;
}

function db_get_fips(county, state) {
    let stmt_fips = 'SELECT FIPS FROM counties WHERE COUNTY_NAME = ? AND STATE_CODE = ?';
    return new Promise( ( resolve, reject ) => {
        db.get(stmt_fips, [county, state], (err, row) => {
            if (err) {
                console.log('Error - db_get_fips(' + county + ', ' + state + '): ' + err);
                reject(err);
            }
            resolve(row);
        });
    } );
}

function db_get_location(fips) {
    let stmt_location = 'SELECT * FROM counties WHERE FIPS = ?';
    return new Promise( ( resolve, reject ) => {
        db.get(stmt_location, [fips], (err, row) => {
            if (err) {
                console.log('Error - db_get_location(' + fips + '): ' + err);
                reject(err);
            }
            resolve(row);
        });
    } );
}

function db_get_data(county, state) {
    let stmt_data = 'SELECT DOMAIN, avg(SCORE) from(' +
        'SELECT Domains.DOMAIN, Indicators.INDICATOR, avg(MetricScores.SCORE) as SCORE ' +
        'FROM MetricScores ' +
        'INNER JOIN Counties ON MetricScores.FIPS = Counties.FIPS ' +
        'INNER JOIN MetricVariables ON MetricScores.METRIC_VAR_ID = MetricVariables.ID ' +
        'INNER JOIN MetricGroups ON MetricVariables.METRIC_GROUP_ID = MetricGroups.ID ' +
        'INNER JOIN Domains ON MetricVariables.DOMAIN_ID = Domains.ID ' +
        'INNER JOIN Indicators ON MetricVariables.INDICATOR_ID = Indicators.ID ' +
        'WHERE Counties.COUNTY_NAME = ? AND Counties.STATE_CODE = ? AND METRIC_GROUP = ? ' +
        'Group By Domains.DOMAIN, Indicators.INDICATOR) Group By DOMAIN';
    return new Promise( ( resolve, reject ) => {
        db.all(stmt_data, [county, state, 'HWBI'], (err, rows) => {
            if (err) {
                console.log('Error - db_get_data(' + county + ', ' + state + '): ' + err);
                reject(err);
            }
            resolve(rows);
        });
    } );
}

function distance(coord1, coord2) {
    let x1 = coord1[0];
    let y1 = coord1[1];
    let x2 = coord2[0];
    let y2 = coord2[1];
    let xs = x2 - x1;
    let ys = y2 - y1;
    xs *= xs;
    ys *= ys;
    return Math.sqrt(xs + ys);
}

function setFill() {
    comp_svg.selectAll('.counties path')
        .transition()
        .duration(300)
        .attr('fill', function(d) {
            if (d.id === currFIPS) { return selectedFill; }
            let matchFound = false;
            for (let i = 0; i < countiesData.length; i++) {
                if (countiesData[i]['FIPS'] === d.id) {
                    matchFound = true;
                }
            }

            if (matchFound) {
                return classByHwbi(d.id);
            } else {
                return noMatchFill;
            }
        });
}

function classByHwbi(FIPS) {
    let currCounty = hwbiByFIPS.get(currFIPS);

    let county = hwbiByFIPS.get(FIPS);

    if (typeof county !== 'undefined') {
        let countyMin = county.hwbi - county.moe;
        let countyMax = county.hwbi + county.moe;

        if (currCounty.hwbi <= countyMax && countyMin <= currCounty.hwbi) {
            return qcolors[2];
        }
        else if (county.hwbi < currCounty.hwbi) {
            let diffRate = currCounty.hwbi - county.hwbi;
            if (diffRate > currCounty.moe*2) {
                return qcolors[4];
            } else {
                return qcolors[3];
            }
        } else {
            let diffRate = county.hwbi - currCounty.hwbi;
            if (diffRate > currCounty.moe*2) {
                return qcolors[0];
            } else {
                return qcolors[1];
            }
        }
    }
    else {
        return noMatchFill;
    }
}

function centerAndZoom(centroid, compareRange) {
    // higher compare ranges need smaller scale
    // scale should be between ~2 - ~10
    // affine transform...
    // mapped_value = ((initial_value - from_lowest) * ((to_highest - to_lowest) / (from_highest - from_lowest))) + to_lowest
    // to invert the range subtract the transform from the length of the range
    let scale = (10 - 0) - (((compareRange - 0) * ((10 - 0) / (80 - 0))) + 0);
    g.transition()
        .duration(1)
        .attr('transform', 'translate(' +center[0] + ', ' + center[1] + ')scale(' + scale + ')translate(' + -centroid[0] + ', ' + -centroid[1] + ')');
}
